/**
 * @file clerk.ts
 * @description Express route handler for processing incoming Clerk webhook events.
 *
 * Clerk sends signed POST requests to this endpoint whenever user-related events
 * occur (e.g., account creation, profile updates, or deletions). The handler:
 *   1. Verifies the webhook signature using the shared signing secret.
 *   2. Parses the verified event payload.
 *   3. Syncs the relevant user data into the application's database.
 *
 * Supported Clerk event types:
 *   - `user.created`  → Inserts a new user record.
 *   - `user.updated`  → Upserts the existing user record with fresh data.
 *   - `user.deleted`  → Removes the user record from the database.
 *
 * @see {@link https://clerk.com/docs/integration/webhooks} Clerk Webhook Docs
 */

import { verifyWebhook } from "@clerk/backend/webhooks";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

import { db } from "../db";
import { users } from "../db/schema";
import { getEnv } from "../lib/env";
import { parseRole } from "../lib/roles";

/**
 * Handles incoming webhook POST requests from Clerk.
 *
 * This handler must be registered on a **raw-body** Express route so that the
 * HMAC signature verification performed by `verifyWebhook` operates on the
 * exact bytes Clerk signed. Parsing the body as JSON before this point would
 * break signature validation.
 *
 * @param {Request}  req - Express request object. `req.body` is expected to be
 *                         a `Buffer` (preferred) or a plain `string` containing
 *                         the raw JSON payload sent by Clerk.
 * @param {Response} res - Express response object used to acknowledge the event
 *                         or return an error status.
 *
 * @returns {Promise<void>} Resolves when the event has been fully processed and
 *                          a response has been sent.  Never rejects — all errors
 *                          are caught internally and mapped to HTTP 400.
 *
 * @example
 * // Register the handler in your Express app (raw body is critical):
 * app.post(
 *   "/webhooks/clerk",
 *   express.raw({ type: "application/json" }),
 *   clerkWebhookHandler,
 * );
 */
export async function clerkWebhookHandler(req: Request, res: Response) {
  const env = getEnv();

  try {
    /*
     * Guard: Webhook secret must be present in the environment.
     *
     * Without the signing secret we cannot cryptographically verify that a
     * request originates from Clerk, so we refuse to process anything and
     * return 503 (Service Unavailable) to signal a server-side misconfiguration
     * rather than a client-side error.
     */
    if (!env.CLERK_WEBHOOK_SECRET) {
      res.status(503).send("Webhooks secret is not provided");
      return;
    }

    /*
     * Normalize the request body to a UTF-8 string.
     *
     * Express can expose `req.body` as a `Buffer` (when the `express.raw()`
     * middleware is used — the recommended setup) or as a `string`. Either way
     * we need a plain string so we can construct a standard Web `Request` object
     * that Clerk's verifier understands.
     */
    const payload =
      req.body instanceof Buffer ? req.body.toString("utf8") : String(req.body);

    /*
     * Reconstruct a Web API `Request` object.
     *
     * `verifyWebhook` from `@clerk/backend` is built against the Fetch API
     * `Request` interface rather than Express's `req` object. We therefore
     * wrap the raw payload and forward all original headers (which carry the
     * Clerk signature headers such as `svix-id`, `svix-timestamp`, and
     * `svix-signature`) into a new `Request`.
     *
     * The URL passed here is only used internally by the verifier and does not
     * need to match the actual public endpoint.
     */
    const request = new Request("http://internal/webhooks/clerk", {
      method: "POST",
      headers: new Headers(req.headers as HeadersInit),
      body: payload,
    });

    /*
     * Verify the webhook signature and deserialize the event.
     *
     * `verifyWebhook` validates the Svix HMAC signature embedded in the
     * request headers against the raw body and the signing secret. It throws
     * an error if:
     *   - The signature header is missing or malformed.
     *   - The HMAC does not match (body was tampered with or wrong secret).
     *   - The timestamp is outside the acceptable tolerance window (replay attack).
     *
     * Only if verification succeeds does `evt` contain trustworthy event data.
     */
    const evt = await verifyWebhook(request, {
      signingSecret: env.CLERK_WEBHOOK_SECRET,
    });

    /* -------------------------------------------------------------------------
     * Event: user.created | user.updated
     *
     * Upsert the user into the local `users` table so that the application
     * always has an up-to-date mirror of the Clerk user profile.
     *
     * Field mapping:
     *   - `clerkUserId`  ← Clerk's immutable user ID (`u.id`).
     *   - `email`        ← The address marked as primary in Clerk; falls back to
     *                      the first available address if the primary lookup fails.
     *   - `displayName`  ← Full name assembled from first + last name; falls back
     *                      to the username; `null` if neither is set.
     *   - `role`         ← Derived from `public_metadata.role` via `parseRole`,
     *                      which coerces unknown values to a safe default.
     *
     * The `.onConflictDoUpdate` clause turns this into an upsert: if a row with
     * the same `clerkUserId` already exists (e.g., a `user.updated` event), all
     * mutable fields are refreshed and `updatedAt` is set to the current time.
     * ------------------------------------------------------------------------- */
    if (evt.type === "user.created" || evt.type === "user.updated") {
      const u = evt.data;

      /**
       * Resolve the user's primary email address.
       *
       * Clerk stores email addresses as an array of objects. We first try to
       * match by the `primary_email_address_id` pointer; if that lookup fails
       * we fall back to the first element of the array.  The result may be
       * `undefined` when no email addresses are associated with the account.
       */
      const email =
        u.email_addresses?.find((e) => e.id === u.primary_email_address_id)
          ?.email_address ?? u.email_addresses?.[0]?.email_address;

      /**
       * Build a human-readable display name with graceful fallbacks:
       *   1. "First Last" (filtering out empty strings)
       *   2. Username
       *   3. `null` — the column must accept NULL if neither is available.
       */
      const displayName =
        [u.first_name, u.last_name].filter(Boolean).join(" ") ||
        u.username ||
        null;

      /**
       * Map the raw `public_metadata.role` value to a typed application role.
       * `parseRole` is responsible for validation and safe defaults, keeping
       * that business logic out of the webhook handler.
       */
      const role = parseRole(u.public_metadata?.role);

      // Upsert: insert new row or update all mutable fields on conflict.
      await db
        .insert(users)
        .values({
          clerkUserId: u.id,
          email,
          displayName,
          role,
        })
        .onConflictDoUpdate({
          target: users.clerkUserId, // Conflict key: Clerk user ID is unique.
          set: { email, displayName, role, updatedAt: new Date() },
        });
    }

    /* -------------------------------------------------------------------------
     * Event: user.deleted
     *
     * Permanently remove the user record from the local database.
     *
     * The `id` field is theoretically always present on a delete event, but
     * the Clerk SDK types it as `string | undefined`, so we guard before use.
     * Deleting a non-existent row is a no-op in SQL — no error will be thrown
     * if the user was never synced locally.
     * ------------------------------------------------------------------------- */
    if (evt.type === "user.deleted") {
      const id = evt.data.id;
      if (id) {
        await db.delete(users).where(eq(users.clerkUserId, id));
      }
    }

    /*
     * Acknowledge successful processing.
     *
     * Clerk considers any 2xx response as a successful delivery. We return a
     * small JSON body for easier debugging in the Clerk dashboard log.
     */
    res.json({ ok: true });
  } catch (err) {
    /*
     * Catch-all error handler.
     *
     * Possible failure modes include:
     *   - Invalid or missing Svix signature headers (verification failure).
     *   - Malformed JSON payload that cannot be deserialized.
     *   - Database constraint violations or connectivity issues.
     *
     * We log the full error server-side for diagnostics but deliberately return
     * a generic 400 response to the caller to avoid leaking internal details.
     */
    console.error("Clerk webhook error", err);
    res.status(400).json({ error: "Invalid webhook" });
  }
}
