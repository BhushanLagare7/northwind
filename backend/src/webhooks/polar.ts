/**
 * @file webhooks/polar.ts
 * @description Express handler and utilities for processing Polar payment webhooks.
 *
 * This module handles incoming webhook events from Polar (a payment processor),
 * verifies their authenticity, and fulfills orders when payments are confirmed.
 *
 * Flow:
 *  1. Receive POST request from Polar
 *  2. Verify webhook signature using StandardWebhooks
 *  3. Parse the event payload
 *  4. On `order.paid` event → look up checkout session → insert order + items → delete session
 */

import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { Webhook } from "standardwebhooks";

import { db } from "../db/index.js";
import { checkoutSessions, orderItems, orders } from "../db/schema.js";
import { getEnv } from "../lib/env.js";

/**
 * Safely extracts a single string value from an Express request header.
 *
 * Express allows headers to be a `string` or `string[]` (for duplicate headers).
 * This helper normalizes that by always returning the first value if it's an array.
 *
 * @param headers - The headers object from an Express `Request`.
 * @param name    - The lowercase header name to look up (e.g. `"webhook-id"`).
 * @returns The header value as a string, or `undefined` if not present.
 *
 * @example
 * const webhookId = headerString(req.headers, "webhook-id");
 */
function headerString(headers: Request["headers"], name: string) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Extracts the internal checkout session ID embedded in Polar's order metadata.
 *
 * When a checkout session is created, its ID is stored in Polar's order metadata
 * under the key `checkout_session_id`. This function safely traverses the
 * `metadata` field of the raw order payload and returns that value.
 *
 * @param order - A raw order object from the Polar webhook payload (`event.data`).
 * @returns The checkout session ID string, or `undefined` if not found or invalid.
 *
 * @example
 * const sessionId = checkoutSessionIdFromMetadata(event.data);
 */
function checkoutSessionIdFromMetadata(order: Record<string, unknown>) {
  const metadata = order.metadata;
  if (!metadata || typeof metadata !== "object") return undefined;
  const sessionId = (metadata as Record<string, unknown>).checkout_session_id;
  return typeof sessionId === "string" ? sessionId : undefined;
}

/**
 * Checks whether an order has already been marked as paid in the database.
 *
 * This guard prevents double-fulfillment in cases where Polar sends duplicate
 * webhook events (a common scenario with webhook delivery retries).
 *
 * It performs up to two independent lookups:
 *  - By `polarOrderId` (the Polar-side order ID)
 *  - By `checkoutId`   (the Polar-side checkout session ID)
 *
 * If either lookup finds a row with `status = "paid"`, the order is considered
 * already fulfilled.
 *
 * @param polarOrderId - The Polar order ID (`data.id` from the webhook payload).
 * @param checkoutId   - The Polar checkout ID (`data.checkout_id` from the payload).
 * @returns `true` if the order has already been paid, `false` otherwise.
 */
async function alreadyPaid(polarOrderId?: string, checkoutId?: string) {
  if (polarOrderId) {
    const [row] = await db
      .select()
      .from(orders)
      .where(eq(orders.polarOrderId, polarOrderId))
      .limit(1);
    if (row?.status === "paid") return true;
  }

  if (checkoutId) {
    const [row] = await db
      .select()
      .from(orders)
      .where(eq(orders.polarCheckoutId, checkoutId))
      .limit(1);
    if (row?.status === "paid") return true;
  }

  return false;
}

/**
 * Atomically fulfills a checkout session by converting it into a paid order.
 *
 * This function runs inside a database transaction to ensure consistency:
 *  1. Locks and fetches the checkout session row (`FOR UPDATE` prevents races).
 *  2. Inserts a new `orders` row with `status = "paid"`.
 *  3. Inserts `orderItems` rows for each line in the checkout session.
 *  4. Deletes the checkout session (it is no longer needed after fulfillment).
 *
 * If the session does not exist (e.g. already deleted by a concurrent request),
 * the transaction returns `false` without throwing, allowing the caller to perform
 * a second `alreadyPaid` check to distinguish a race condition from a real error.
 *
 * @param sessionId    - The internal checkout session ID to fulfill.
 * @param polarOrderId - The Polar order ID to associate with the created order.
 * @param checkoutId   - The Polar checkout ID to associate with the created order.
 * @returns `true` if fulfillment succeeded, `false` if the session was not found.
 *
 * @throws Will propagate any unexpected database errors from the transaction.
 */
async function fulfillCheckoutSession(
  sessionId: string,
  polarOrderId: string | undefined,
  checkoutId: string | undefined,
) {
  return await db.transaction(async (tx) => {
    // Lock the session row to prevent concurrent fulfillment of the same session.
    const [session] = await tx
      .select()
      .from(checkoutSessions)
      .where(eq(checkoutSessions.id, sessionId))
      .for("update");

    // Session not found — likely already fulfilled by a concurrent request.
    if (!session) return false;

    // Create the paid order record.
    const [order] = await tx
      .insert(orders)
      .values({
        userId: session.userId,
        status: "paid",
        totalCents: session.totalCents,
        polarCheckoutId: checkoutId ?? session.polarCheckoutId ?? null,
        ...(polarOrderId ? { polarOrderId } : {}),
      })
      .returning();

    // Insert individual line items if the session contained any.
    if (session.lines.length) {
      await tx.insert(orderItems).values(
        session.lines.map((line) => ({
          orderId: order.id,
          productId: line.productId,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
        })),
      );
    }

    // Remove the checkout session now that it has been converted to an order.
    await tx.delete(checkoutSessions).where(eq(checkoutSessions.id, sessionId));

    return true;
  });
}

/**
 * Express route handler for incoming Polar webhook events.
 *
 * ### Security
 * Every request is verified using the StandardWebhooks signature scheme before
 * any business logic runs. Requests with missing or invalid signatures are
 * rejected with `400 Bad Request`.
 *
 * ### Supported events
 * | Event type   | Action                                              |
 * |--------------|-----------------------------------------------------|
 * | `order.paid` | Fulfill the associated checkout session as an order |
 * | *(any other)*| Acknowledged with `{ ok: true }` and ignored        |
 *
 * ### Idempotency
 * The handler is safe to call multiple times for the same event.
 * A pre-check (`alreadyPaid`) and a post-check (after a failed fulfillment)
 * both guard against double-processing, returning `{ ok: true, duplicate: true }`
 * for subsequent deliveries of the same event.
 *
 * ### Expected request shape
 * - **Body**: Raw binary buffer containing the JSON event payload.
 * - **Headers**:
 *   - `webhook-id`        — Unique ID for this webhook delivery.
 *   - `webhook-timestamp` — Unix timestamp of the delivery attempt.
 *   - `webhook-signature` — HMAC signature for payload verification.
 *
 * ### Response codes
 * | Status | Meaning                                            |
 * |--------|----------------------------------------------------|
 * | `200`  | Event acknowledged (fulfilled or safely ignored)   |
 * | `400`  | Missing headers or invalid webhook signature       |
 * | `500`  | Fulfillment failed for an unexpected reason        |
 * | `503`  | Webhook secret is not configured in the environment|
 *
 * @param req - Express `Request` object (body must be a raw `Buffer`).
 * @param res - Express `Response` object used to send the acknowledgement.
 *
 * @example
 * // Register in your Express app:
 * app.post(
 *   "/webhooks/polar",
 *   express.raw({ type: "application/json" }),
 *   polarWebhookHandler,
 * );
 */
export async function polarWebhookHandler(req: Request, res: Response) {
  const env = getEnv();

  try {
    // Guard: webhook processing requires a configured secret.
    if (!env.POLAR_WEBHOOK_SECRET) {
      res.status(503).send("Polar webhooks not configured");
      return;
    }

    // Normalize the request body to a Buffer for signature verification.
    const raw =
      req.body instanceof Buffer ? req.body : Buffer.from(String(req.body));

    // Instantiate the webhook verifier with the secret encoded as base64.
    const wh = new Webhook(
      Buffer.from(env.POLAR_WEBHOOK_SECRET, "utf8").toString("base64"),
    );

    // Extract the three required StandardWebhooks signature headers.
    const id = headerString(req.headers, "webhook-id");
    const ts = headerString(req.headers, "webhook-timestamp");
    const sig = headerString(req.headers, "webhook-signature");

    if (!id || !ts || !sig) {
      res.status(400).json({ error: "Missing webhook headers" });
      return;
    }

    // Throws if the signature is invalid — caught by the outer try/catch.
    wh.verify(raw, {
      "webhook-id": id,
      "webhook-timestamp": ts,
      "webhook-signature": sig,
    });

    // Parse the verified payload into a typed event structure.
    const event = JSON.parse(raw.toString("utf8")) as {
      type: string;
      data?: Record<string, unknown>;
    };

    // Handle the `order.paid` event — the only event that triggers fulfillment.
    if (event.type === "order.paid" && event.data) {
      const data = event.data;

      const polarOrderId = typeof data.id === "string" ? data.id : undefined;
      const checkoutId =
        typeof data.checkout_id === "string" ? data.checkout_id : undefined;

      // Early duplicate check before touching the checkout session.
      if (await alreadyPaid(polarOrderId, checkoutId)) {
        res.json({ ok: true, duplicate: true });
        return;
      }

      const sessionId = checkoutSessionIdFromMetadata(data);

      if (sessionId) {
        const ok = await fulfillCheckoutSession(
          sessionId,
          polarOrderId,
          checkoutId,
        );

        if (ok) {
          res.json({ ok: true });
          return;
        }

        // fulfillCheckoutSession returned false (session not found).
        // Check whether a concurrent request already fulfilled it.
        if (await alreadyPaid(polarOrderId, checkoutId)) {
          res.json({ ok: true, duplicate: true });
          return;
        }

        // Session was not found and the order is not marked paid — unexpected state.
        console.error("Polar order.paid: could not fulfill checkout session", {
          sessionId,
          checkoutId,
        });

        res.status(500).json({ error: "Checkout fulfillment failed" });
        return;
      }
    }

    // Acknowledge all other event types without taking action.
    res.json({ ok: true });
  } catch (err) {
    // Catches signature verification failures and any unexpected runtime errors.
    console.error("Polar webhook error", err);
    res.status(400).json({ error: "Invalid webhook" });
  }
}
