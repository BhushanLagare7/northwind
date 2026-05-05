import type { Env } from "./env.js";

/** Request body accepted by the Polar `POST /v1/checkouts/` endpoint. */
type CheckoutCreateBody = {
  /** IDs of the Polar products to include in this checkout. */
  products: string[];

  /**
   * Optional per-product price overrides, keyed by product ID.
   * Use this to set a fixed amount instead of the product's default price.
   */
  prices?: Record<
    string,
    Array<{
      amount_type: "fixed";
      /** Amount in the smallest currency unit (e.g. cents for USD). */
      price_amount: number;
      /** ISO 4217 currency code (e.g. `"usd"`). */
      price_currency: string;
    }>
  >;

  /** URL Polar redirects the customer to after a successful payment. */
  success_url: string;

  /** URL Polar redirects the customer to if they cancel or go back. */
  return_url?: string;

  /** Your internal customer identifier, used to link the Polar session to a local user. */
  external_customer_id?: string;

  /** Pre-fill the customer's email on the Polar checkout page. */
  customer_email?: string;

  /** Arbitrary key-value pairs attached to the session (e.g. `{ checkout_session_id: "..." }`). */
  metadata?: Record<string, string | number | boolean>;
};

/**
 * Creates a hosted checkout session via the Polar API.
 *
 * @param env  - Application environment containing `POLAR_ACCESS_TOKEN` and `POLAR_API_BASE`.
 * @param body - Checkout configuration (products, prices, redirect URLs, etc.).
 * @returns    The new session's `id` and hosted checkout `url`.
 * @throws     If `POLAR_ACCESS_TOKEN` is missing or the Polar API returns a non-2xx response.
 */
export async function polarCreateCheckout(env: Env, body: CheckoutCreateBody) {
  const token = env.POLAR_ACCESS_TOKEN;
  if (!token) throw new Error("POLAR_ACCESS_TOKEN is not configured");

  const res = await fetch(`${env.POLAR_API_BASE}/v1/checkouts/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Polar checkout failed: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as { id: string; url: string };
  return { id: data.id, url: data.url };
}
