/**
 * @fileoverview Custom hook for fetching and deriving state for the Order Detail page.
 * Retrieves a single order and its associated line items from the API, and exposes
 * computed values such as payment status for use by the consuming component.
 *
 * @module useOrderDetailPage
 */

import { useParams } from "react-router";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api.js";

/**
 * @typedef {Object} OrderItem
 * @property {string} id          - Unique identifier for the line item.
 * @property {string} orderId     - The ID of the order.
 * @property {string} productId   - The ID of the product.
 * @property {number} quantity    - Number of units ordered.
 * @property {number} unitPriceCents - Price per single unit in cents.
 */

/**
 * @typedef {Object} Order
 * @property {string}  id          - Unique identifier for the order.
 * @property {string}  userId      - The ID of the user who placed the order.
 * @property {string}  status      - Current status of the order (e.g. "pending", "paid", "failed").
 * @property {string}  polarCheckoutId - The ID of the checkout session in Polar.
 * @property {string}  polarOrderId - The ID of the order in Polar.
 * @property {number}  totalCents  - Total order amount in cents.
 * @property {string}  createdAt   - ISO 8601 timestamp of when the order was created.
 * @property {string}  updatedAt   - ISO 8601 timestamp of when the order was last updated.
 */

/**
 * @typedef {Object} OrderDetailPageResult
 * @property {string}          id        - The order ID extracted from the current route parameters.
 * @property {Order|null}      order     - The fetched order object, or null if not yet loaded
 *                                         or unavailable.
 * @property {OrderItem[]}     items     - Array of line items belonging to the order.
 *                                         Defaults to an empty array while loading or on error.
 * @property {boolean}         paid      - True if the order's status is "paid", false otherwise.
 * @property {boolean}         isLoading - True while the order data is being fetched.
 * @property {Error|null}      error     - The error object if the query failed, otherwise null.
 */

/**
 * Custom hook that fetches and manages state for a single order's detail page.
 *
 * @description
 * This hook centralizes all data-fetching logic required by the Order Detail page:
 * - Reads the order ID from the current route via `useParams`.
 * - Authenticates API requests using Clerk's `getToken`.
 * - Fetches the order and its line items from `/api/orders/:id` using React Query.
 * - Derives human-friendly booleans and safe defaults from the raw API response
 *   so that consuming components do not need to handle nullish checks themselves.
 *
 * The query is skipped entirely when no order ID is present in the route,
 * preventing unnecessary network requests.
 *
 * @requires The component using this hook must be:
 * - Rendered under a React Router route that provides an `id` param.
 * - Wrapped in a Clerk authentication provider (`<ClerkProvider>`).
 * - Wrapped in a React Query provider (`<QueryClientProvider>`).
 *
 * @example
 * // Basic usage inside the OrderDetailPage component
 * function OrderDetailPage() {
 *   const { order, items, paid, isLoading, error } = useOrderDetailPage();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error)     return <ErrorMessage message={error.message} />;
 *   if (!order)    return <NotFound />;
 *
 *   return (
 *     <div>
 *       <h1>Order #{order.id}</h1>
 *       <p>Status: {order.status}</p>
 *       {paid && <Badge label="Paid" />}
 *       <ul>
 *         {items.map((item) => (
 *           <li key={item.id}>{item.name} × {item.quantity}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 *
 * @returns {OrderDetailPageResult} An object containing the order data, line items,
 *                                   payment status flag, loading state, and any fetch error.
 */
export function useOrderDetailPage() {
  /**
   * The order ID from the current route (e.g. `/orders/:id`).
   * Used as both the React Query cache key segment and the API path parameter.
   *
   * @type {string}
   */
  const { id } = useParams();

  /**
   * Clerk's `getToken` function used to attach a bearer token to outgoing
   * API requests, ensuring only authenticated users can fetch order data.
   *
   * @type {{ getToken: Function }}
   */
  const { getToken } = useAuth();

  /**
   * React Query result for the order detail request.
   *
   * @description
   * - `queryKey: ["order", id]` — Scopes the cache entry to this specific order ID,
   *   so navigating between orders always fetches fresh data per order.
   * - `queryFn` — Calls the authenticated API helper to GET `/api/orders/:id`.
   * - `enabled: Boolean(id)` — Prevents the query from running when `id` is
   *   undefined or an empty string (e.g., during initial render or bad routing).
   *
   * @type {{
   *   data:      { order: Order, items: OrderItem[] } | undefined,
   *   isLoading: boolean,
   *   error:     Error | null
   * }}
   */
  const { data, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiFetch(`/api/orders/${id}`, { getToken }),
    enabled: Boolean(id),
  });

  /**
   * The order object from the API response.
   * Falls back to null while the query is in-flight or if the response
   * does not include an order (e.g., 404 scenarios).
   *
   * @type {Order|null}
   */
  const order = data?.order ?? null;

  /**
   * The list of line items associated with the order.
   * Defaults to an empty array so consumers can safely call `.map()` or
   * `.length` without additional null-checks during loading or on error.
   *
   * @type {OrderItem[]}
   */
  const items = data?.items ?? [];

  /**
   * Convenience boolean indicating whether the order has been successfully paid.
   * Derived from the order's `status` field to avoid repeating this check
   * across multiple child components.
   *
   * @type {boolean}
   */
  const paid = order?.status === "paid";

  return {
    /** The order ID from the route params. @type {string} */
    id,

    /** The fetched order, or null if unavailable. @type {Order|null} */
    order,

    /** Line items for the order. @type {OrderItem[]} */
    items,

    /** True when the order status is "paid". @type {boolean} */
    paid,

    /** True while the API request is in-flight. @type {boolean} */
    isLoading,

    /** The fetch error, or null if the request succeeded. @type {Error|null} */
    error,
  };
}
