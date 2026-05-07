/**
 * @file useCartPage.js
 * @description Custom React hook that encapsulates all business logic for the
 * shopping cart page, including product fetching, line-item calculation,
 * subtotal computation, and Stripe checkout redirection.
 */

import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api";
import { useCart } from "../store/cart";

/**
 * Represents a single enriched cart line item that pairs the raw cart entry
 * with its corresponding product details fetched from the API.
 *
 * @typedef {Object} CartLine
 * @property {CartItem}    line    - The raw cart item (productId + quantity).
 * @property {Product|null} product - The matching product from the API,
 *                                    or `null` if the product hasn't loaded yet
 *                                    or was not found.
 */

/**
 * @typedef {Object} UseCartPageReturn
 * @property {CartItem[]}  items            - Raw list of items currently in the cart store.
 * @property {Function}    setQty           - Updates the quantity of a specific cart item.
 * @property {Function}    removeItem       - Removes an item from the cart by productId.
 * @property {boolean}     productsLoading  - `true` while product data is being fetched.
 * @property {boolean}     productsError    - `true` if the product fetch request failed.
 * @property {CartLine[]}  lines            - Enriched line items combining cart state
 *                                           and product data.
 * @property {number}      subtotal         - Total price in cents across all valid line items.
 * @property {Function}    checkout         - Initiates the checkout flow and redirects
 *                                           to the payment URL on success.
 * @property {boolean}     checkoutLoading  - `true` while the checkout request is in-flight.
 */

/**
 * `useCartPage` is a custom hook that manages the full state and behavior
 * of the shopping cart page.
 *
 * ### Responsibilities
 * - Reads cart items and actions (`setQty`, `removeItem`) from the global cart store.
 * - Fetches product details from `/api/products` (only when the cart is non-empty)
 *   and merges them with the raw cart lines.
 * - Computes the order subtotal in cents.
 * - Handles the POST request to `/api/checkout`, managing its loading state and
 *   redirecting the browser to the returned Stripe checkout URL.
 *
 * ### Authentication
 * Uses Clerk's `getToken` to attach an auth token to the checkout request via
 * the shared `apiFetch` helper.
 *
 * ### Data Fetching
 * Product data is fetched with React Query under the `["products"]` query key.
 * The query is disabled when the cart is empty to avoid unnecessary network
 * requests.
 *
 * @returns {UseCartPageReturn} All state and handlers needed to render the cart page.
 *
 * @example
 * ```tsx
 * function CartPage() {
 *   const {
 *     lines,
 *     subtotal,
 *     setQty,
 *     removeItem,
 *     checkout,
 *     checkoutLoading,
 *     productsLoading,
 *     productsError,
 *   } = useCartPage();
 *
 *   if (productsLoading) return <Spinner />;
 *   if (productsError)   return <ErrorMessage />;
 *
 *   return (
 *     <>
 *       {lines.map(({ line, product }) => (
 *         <CartLineItem
 *           key={line.productId}
 *           line={line}
 *           product={product}
 *           onChangeQty={setQty}
 *           onRemove={removeItem}
 *         />
 *       ))}
 *       <p>Subtotal: {formatCents(subtotal)}</p>
 *       <button onClick={checkout} disabled={checkoutLoading}>
 *         {checkoutLoading ? "Redirecting…" : "Checkout"}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */
export default function useCartPage() {
  const { getToken } = useAuth();

  /**
   * Tracks whether the checkout POST request is currently in-flight.
   * Set to `true` before the request and reset to `false` only on failure
   * (on success the page is redirected, making a reset unnecessary).
   */
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Cart store selectors
  // ---------------------------------------------------------------------------

  /** Raw list of cart items from the global cart store. */
  const items = useCart((s) => s.items);

  /** Action to update the quantity of a cart item. */
  const setQty = useCart((s) => s.setQty);

  /** Action to remove an item from the cart entirely. */
  const removeItem = useCart((s) => s.removeItem);

  // ---------------------------------------------------------------------------
  // Product data fetching
  // ---------------------------------------------------------------------------

  /**
   * Fetch all products from the API so that price and metadata can be displayed
   * alongside each cart line.
   *
   * The query is intentionally disabled when the cart is empty to avoid
   * making a network request that would return unused data.
   */
  const {
    data,
    isLoading: productsLoading,
    isError: productsError,
  } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiFetch("/api/products"),
    enabled: items.length > 0,
  });

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  /** Flat array of products returned by the API, defaulting to empty. */
  const products = data?.products ?? [];

  /** Fast O(1) product lookup map keyed by product ID. */
  const byId = new Map(products.map((p) => [p.id, p]));

  /**
   * Enriched line items that pair each raw cart entry with its product details.
   * `product` will be `null` for items whose product could not be found in the
   * API response (e.g. deleted products).
   */
  const lines = items.map((line) => ({
    line,
    product: byId.get(line.productId) ?? null,
  }));

  /**
   * Order subtotal in cents, computed by summing `priceCents × quantity` for
   * every line item that has a resolved product. Lines with a `null` product
   * (not yet loaded or not found) are skipped.
   */
  const subtotal = lines.reduce((sum, { line, product: p }) => {
    if (!p) return sum;
    return sum + p.priceCents * line.quantity;
  }, 0);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Initiates the checkout process by POSTing the current cart items to the
   * `/api/checkout` endpoint.
   *
   * - Sets `checkoutLoading` to `true` at the start of the request.
   * - On success, redirects the browser to the Stripe checkout URL returned by
   *   the API (`res.checkoutUrl`). Because the page is being navigated away,
   *   `checkoutLoading` is intentionally **not** reset to `false`.
   * - On failure or if no checkout URL is returned, resets `checkoutLoading`
   *   to `false` so the user can retry.
   *
   * @async
   * @returns {Promise<void>}
   */
  async function checkout() {
    setCheckoutLoading(true);

    const body = {
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    };

    const res = await apiFetch("/api/checkout", {
      getToken,
      method: "POST",
      body,
    });

    if (res?.checkoutUrl) {
      // Redirect the browser to the hosted Stripe checkout page.
      window.location.href = res.checkoutUrl;
      return;
    }

    // Checkout did not return a URL — reset loading so the user can retry.
    setCheckoutLoading(false);
  }

  return {
    items,
    setQty,
    removeItem,
    productsLoading,
    productsError,
    lines,
    subtotal,
    checkout,
    checkoutLoading,
  };
}
