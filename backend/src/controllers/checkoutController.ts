/**
 * @file checkoutController.ts
 * @description Express controller that handles the creation of a checkout session.
 *
 * Flow:
 *  1. Authenticate the request via Clerk.
 *  2. Validate the incoming cart payload.
 *  3. Verify that every requested product exists and is active in the database.
 *  4. Calculate the order total and persist a pending checkout session locally.
 *  5. Create a matching checkout session in Polar (payment provider).
 *  6. Link the Polar checkout ID back to the local session record.
 *  7. Return the Polar-hosted checkout URL to the client.
 */

import { getAuth } from "@clerk/express";
import { and, eq, inArray } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import z from "zod";

import { db } from "../db";
import { CheckoutSessionLine, checkoutSessions, products } from "../db/schema";
import { getEnv } from "../lib/env";
import { polarCreateCheckout } from "../lib/polar";
import { getLocalUser } from "../lib/users";

const env = getEnv();

/**
 * Zod schema used to validate the request body for creating a checkout session.
 *
 * Expected shape:
 * ```json
 * {
 *   "items": [
 *     { "productId": "<uuid>", "quantity": 1 }
 *   ]
 * }
 * ```
 *
 * Constraints:
 * - `items`     – non-empty array (minimum 1 item).
 * - `productId` – a valid UUID v4 string.
 * - `quantity`  – a positive integer (≥ 1).
 */
const cartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

/**
 * Express request handler that creates a new checkout session.
 *
 * @param req  - Express `Request` object. Expects a JSON body that satisfies
 *               {@link cartSchema}.
 * @param res  - Express `Response` object used to send the checkout URL or an
 *               error payload.
 * @param next - Express `NextFunction` used to forward unexpected errors to the
 *               global error handler middleware.
 *
 * @returns Sends one of the following HTTP responses:
 *
 * | Status | Condition                                              |
 * |--------|--------------------------------------------------------|
 * | 200    | Checkout created successfully – body: `{ checkoutUrl }`|
 * | 400    | Invalid cart body, invalid products, or total too low  |
 * | 401    | Request is not authenticated                           |
 * | 503    | Payment provider not configured / account not synced   |
 *
 * @example
 * // POST /checkout
 * // Body:
 * {
 *   "items": [
 *     { "productId": "d290f1ee-6c54-4b01-90e6-d701748f0851", "quantity": 2 }
 *   ]
 * }
 *
 * // 200 OK
 * { "checkoutUrl": "https://checkout.polar.sh/..." }
 */
export async function createCheckout(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    /**
     * Step 1 – Authentication
     * Only signed-in users (verified via Clerk) are permitted to initiate a
     * checkout. Unauthenticated requests are rejected immediately.
     */
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    /**
     * Step 2 – Request body validation
     * Use the cartSchema to ensure the payload is well-formed before touching
     * the database or payment provider.
     */
    const parsed = cartSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid cart", details: parsed.error.flatten() });
      return;
    }

    /**
     * Step 3 – Payment provider configuration check
     * If POLAR_ACCESS_TOKEN is absent from the environment the service cannot
     * communicate with Polar, so we fail fast with a 503.
     */
    if (!env.POLAR_ACCESS_TOKEN) {
      res.status(503).json({ error: "Payments are not configured" });
      return;
    }

    /**
     * Step 4 – Local user resolution
     * The Clerk `userId` is mapped to an internal database user record. If the
     * account has not been synced yet (e.g., webhook delivery delay), we cannot
     * associate the session with the correct user.
     */
    const localUser = await getLocalUser(userId);
    if (!localUser) {
      res.status(503).json({ error: "Account not synced yet" });
      return;
    }

    /** Collect every unique product ID from the cart. */
    const ids = parsed.data.items.map((i) => i.productId);

    /**
     * Step 5 – Product validation
     * Query the database for all products that:
     *  - have an ID included in the cart, AND
     *  - are currently marked as active.
     *
     * If the number of returned rows does not match the number of requested IDs,
     * at least one product is either missing or inactive.
     */
    const prodRows = await db
      .select()
      .from(products)
      .where(and(inArray(products.id, ids), eq(products.active, true)));

    if (prodRows.length !== ids.length) {
      res.status(400).json({ error: "One or more products are invalid" });
      return;
    }

    /**
     * Step 6 – Order total calculation
     * Build a Map keyed by product ID for O(1) look-ups, then iterate over the
     * validated cart items to:
     *  - accumulate the total cost in cents, and
     *  - build the `lines` array that will be stored with the session.
     */
    const byId = new Map(prodRows.map((p) => [p.id, p]));
    let totalCents = 0;
    const lines: CheckoutSessionLine[] = [];

    for (const line of parsed.data.items) {
      const p = byId.get(line.productId)!; // safe: existence guaranteed above
      totalCents += p.priceCents * line.quantity;
      lines.push({
        productId: p.id,
        quantity: line.quantity,
        unitPriceCents: p.priceCents,
      });
    }

    /**
     * Step 7 – Minimum order amount enforcement
     * Polar requires a minimum charge amount. A total below 10 cents (e.g.,
     * $0.10 USD) would be rejected by the payment provider anyway, so we
     * surface a descriptive error early.
     */
    if (totalCents < 10) {
      res.status(400).json({
        error:
          "Total below Polar minimum (e.g. USD requires at least 10 cents)",
      });
      return;
    }

    /**
     * Step 8 – Persist pending checkout session
     * Insert a local checkout session record before calling Polar so that
     * every initiated checkout is traceable even if the external call fails.
     * The `polarCheckoutId` column is populated in a subsequent update.
     */
    const [session] = await db
      .insert(checkoutSessions)
      .values({
        userId: localUser.id,
        lines,
        totalCents,
        currency: "usd",
      })
      .returning();

    /**
     * Build redirect URLs that Polar will use after the payment flow:
     * - `successUrl` – user lands here on successful payment; `{CHECKOUT_ID}`
     *    is a Polar template variable replaced at redirect time.
     * - `returnUrl`  – user lands here if they cancel / go back.
     */
    const successUrl = `${env.FRONTEND_URL}/checkout/return?checkout_id={CHECKOUT_ID}`;
    const returnUrl = `${env.FRONTEND_URL}/cart`;

    /**
     * Step 9 – Create Polar checkout session
     * We pass a single product with a dynamically priced line (fixed amount)
     * equal to the calculated order total. The local session ID is stored in
     * Polar's metadata so that the webhook handler can reconcile the two
     * records once payment completes.
     */
    const checkout = await polarCreateCheckout(env, {
      products: [env.POLAR_CHECKOUT_PRODUCT_ID],
      prices: {
        [env.POLAR_CHECKOUT_PRODUCT_ID]: [
          {
            amount_type: "fixed",
            price_currency: "usd",
            price_amount: totalCents,
          },
        ],
      },
      success_url: successUrl,
      return_url: returnUrl,
      /** Link the Polar session back to the authenticated Clerk user. */
      external_customer_id: userId,
      metadata: { checkout_session_id: session.id },
    });

    /**
     * Step 10 – Link Polar checkout ID to the local session
     * Update the previously inserted record with the ID returned by Polar so
     * that future lookups (e.g., webhook processing) can join the two records.
     */
    await db
      .update(checkoutSessions)
      .set({ polarCheckoutId: checkout.id })
      .where(eq(checkoutSessions.id, session.id));

    /**
     * Step 11 – Respond with the hosted checkout URL
     * The client should redirect the user to this URL to complete payment on
     * the Polar-hosted checkout page.
     */
    res.json({ checkoutUrl: checkout.url });
  } catch (e) {
    /**
     * Forward any unexpected errors (network failures, DB errors, etc.) to
     * the Express global error-handling middleware.
     */
    next(e);
  }
}
