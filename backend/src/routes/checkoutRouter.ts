import { Router } from "express";

import { createCheckout } from "../controllers/checkoutController";

/**
 * POST /
 * Creates a new checkout session for the authenticated user.
 *
 * Expects a JSON body describing the cart:
 * ```
 * { "items": [ { "productId": "<uuid>", "quantity": 1 } ] }
 * ```
 *
 * @returns 200 - On success, returns the Polar checkout URL:
 *                `{ "checkoutUrl": "https://checkout.polar.sh/..." }`
 * @returns 400 - If the cart is invalid or contains inactive products.
 * @returns 401 - If the request is unauthenticated.
 * @returns 503 - If the payment provider is not configured.
 */
const router = Router();

router.post("/", createCheckout);

export default router;
