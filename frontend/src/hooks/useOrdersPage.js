/**
 * @fileoverview Custom hook for managing orders page data and state.
 * Handles fetching orders and determining user staff privileges.
 *
 * @module useOrdersPage
 * @requires @clerk/react
 * @requires @tanstack/react-query
 */

import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api.js";

/**
 * @typedef {Object} Order
 * @property {string} id               - Unique identifier for the order
 * @property {string} status           - Payment lifecycle state (pending, paid, failed)
 * @property {string} polarCheckoutId  - Polar checkout session ID
 * @property {string} polarOrderId     - Polar order ID
 * @property {number} totalCents       - Grand total in smallest currency unit
 * @property {string} createdAt        - ISO timestamp of when the order was created
 * @property {string} updatedAt        - ISO timestamp of when the order was last updated
 */

/**
 * @typedef {Object} OrdersPageState
 * @property {boolean}   isLoading - Whether the orders data is currently being fetched
 * @property {Error|null} error    - Error object if the orders fetch failed, null otherwise
 * @property {Order[]}   orders   - Array of order objects, empty array if no orders exist
 * @property {boolean}   staff    - Whether the current user has staff privileges
 *                                  (true if user role is 'support' or 'admin')
 */

/**
 * Custom hook that fetches and manages orders page data.
 *
 * Performs two parallel API calls:
 * - Fetches the list of orders from `/api/orders`
 * - Fetches the current user's profile from `/api/me` to determine staff status
 *
 * Both queries are conditionally enabled based on the user's authentication status.
 * Unauthenticated users will not trigger any API calls.
 *
 * @returns {OrdersPageState} An object containing:
 *  - `isLoading` {boolean}    - True while orders data is being fetched
 *  - `error`     {Error|null} - Any error encountered during the orders fetch
 *  - `orders`    {Order[]}    - List of fetched orders (defaults to empty array)
 *  - `staff`     {boolean}    - True if user has 'support' or 'admin' role
 *
 * @example
 * function OrdersPage() {
 *   const { isLoading, error, orders, staff } = useOrdersPage();
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       {staff && <StaffControls />}
 *       <OrdersList orders={orders} />
 *     </div>
 *   );
 * }
 */
function useOrdersPage() {
  /**
   * Retrieves the Clerk authentication token and sign-in status.
   * - `getToken`  : Async function to retrieve the current session token
   * - `isSignedIn`: Boolean indicating whether the user is authenticated
   */
  const { getToken, isSignedIn } = useAuth();

  /**
   * Fetches the list of orders for the authenticated user.
   * Query is disabled for unauthenticated users to prevent unauthorized requests.
   *
   * @type {{ data: { orders: Order[] } | undefined, isLoading: boolean, error: Error | null }}
   */
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: () => apiFetch("/api/orders", { getToken }),
    enabled: isSignedIn, // Only fetch when the user is authenticated
  });

  /**
   * Fetches the current authenticated user's profile data.
   * Used to determine the user's role and staff privileges.
   * Query is disabled for unauthenticated users.
   *
   * @type {{ data: { user: { role: string } } | undefined }}
   */
  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/me", { getToken }),
    enabled: isSignedIn, // Only fetch when the user is authenticated
  });

  /**
   * Determines if the current user has staff-level access.
   * Users with 'support' or 'admin' roles are considered staff.
   *
   * @type {boolean}
   */
  const staff =
    meData?.user?.role === "support" || meData?.user?.role === "admin";

  /**
   * Safely extracts the orders array from the API response.
   * Defaults to an empty array if no orders data is available,
   * preventing undefined errors in consuming components.
   *
   * @type {Order[]}
   */
  const orders = data?.orders ?? [];

  return {
    isLoading,
    error,
    orders,
    staff,
  };
}

export default useOrdersPage;
