/**
 * @file useOrderVideoPage.js
 * @description Custom React hook that manages the state and logic for an order's
 * video call page. It fetches order details, verifies payment status, and
 * establishes a Stream Video connection for paid orders.
 */

import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useAuth } from "@clerk/react";
import { StreamVideoClient } from "@stream-io/video-react-sdk";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api";

/**
 * @typedef {Object} Order
 * @property {string} id        - The unique identifier for the order.
 * @property {string} status    - The current status of the order (e.g., "paid", "pending").
 */

/**
 * @typedef {Object} OrderVideoPageState
 * @property {string|undefined}        id        - The order ID extracted from the URL parameters.
 * @property {Order|undefined}         order     - The fetched order object, or undefined if not yet loaded.
 * @property {boolean}                 paid      - Whether the order has been paid for.
 * @property {boolean}                 isLoading - Whether the order data is currently being fetched.
 * @property {Error|null}              loadError - Any error that occurred while fetching the order, or null.
 * @property {StreamVideoClient|null}  client    - The Stream Video client instance, or null if not connected.
 * @property {object|null}             call      - The active Stream Video call instance, or null if not joined.
 * @property {string|null}             error     - Any error message from the video connection process, or null.
 */

/**
 * Custom hook for the Order Video Page.
 *
 * Responsibilities:
 * - Reads the order `id` from the URL via `useParams`.
 * - Fetches the order details from the API using React Query (only when
 *   the user is signed in and a valid `id` is present).
 * - Determines whether the order has been paid for.
 * - When the order is paid and the user is authenticated, it:
 *   1. Requests a Stream Video token from the server.
 *   2. Initializes a `StreamVideoClient` with the returned credentials.
 *   3. Joins (or creates) a video call scoped to the order (`order-{id}`).
 * - Cleans up the call and disconnects the video client when the component
 *   using this hook unmounts, or when relevant dependencies change.
 *
 * @returns {OrderVideoPageState} The current state of the order video page.
 *
 * @example
 * function OrderVideoPage() {
 *   const { id, order, paid, isLoading, loadError, client, call, error } =
 *     useOrderVideoPage();
 *
 *   if (isLoading) return <p>Loading order...</p>;
 *   if (loadError) return <p>Failed to load order.</p>;
 *   if (!paid)     return <p>Order has not been paid for.</p>;
 *   if (error)     return <p>Video error: {error}</p>;
 *   if (!call)     return <p>Connecting to video...</p>;
 *
 *   return <VideoCallUI client={client} call={call} />;
 * }
 */
function useOrderVideoPage() {
  // ─── URL Parameters ────────────────────────────────────────────────────────

  /** @type {string|undefined} The order ID from the current route. */
  const { id } = useParams();

  // ─── Authentication ────────────────────────────────────────────────────────

  /**
   * `getToken`  – Returns a promise that resolves to the current user's JWT.
   * `isSignedIn` – Boolean flag indicating whether the user is authenticated.
   */
  const { getToken, isSignedIn } = useAuth();

  // ─── Local State ───────────────────────────────────────────────────────────

  /**
   * The initialized Stream Video client.
   * Remains `null` until the video connection is successfully established.
   *
   * @type {[StreamVideoClient|null, Function]}
   */
  const [client, setClient] = useState(null);

  /**
   * The active Stream Video call object.
   * Remains `null` until the call has been successfully joined.
   *
   * @type {[object|null, Function]}
   */
  const [call, setCall] = useState(null);

  /**
   * A human-readable error message if the video connection fails.
   * Remains `null` when there is no error.
   *
   * @type {[string|null, Function]}
   */
  const [error, setError] = useState(null);

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  /**
   * Fetches the order from the API.
   *
   * - The query is keyed by `["order", id]` so that React Query can cache
   *   and deduplicate requests per order ID.
   * - The query is disabled until both `id` is defined and the user is
   *   signed in, preventing unnecessary or unauthenticated requests.
   */
  const {
    data,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiFetch(`/api/orders/${id}`, { getToken }),
    enabled: Boolean(id) && isSignedIn,
  });

  // ─── Derived State ─────────────────────────────────────────────────────────

  /** @type {Order|undefined} The order object from the API response. */
  const order = data?.order;

  /**
   * Whether the order has been paid for.
   * The video call is only established when this is `true`.
   *
   * @type {boolean}
   */
  const paid = order?.status === "paid";

  // ─── Video Connection Effect ───────────────────────────────────────────────

  /**
   * Initializes the Stream Video client and joins the call whenever the
   * order transitions to a paid state.
   *
   * Dependencies:
   * - `paid`      – Triggers setup when the order becomes paid.
   * - `id`        – Ensures the correct call ID is used if the route changes.
   * - `getToken`  – Required for authenticating the Stream token request.
   * - `isSignedIn` – Guards against running when the user logs out mid-session.
   *
   * Clean-up:
   * The returned function runs when the component unmounts or dependencies
   * change. It gracefully leaves the active call and disconnects the video
   * client to release resources and prevent memory leaks.
   */
  useEffect(() => {
    // Guard: only proceed when the order is paid and the user is authenticated.
    if (!paid || !id || !isSignedIn) return undefined;

    /**
     * These variables are captured in the closure so the clean-up function
     * can reference the same instances that were created during setup,
     * regardless of any subsequent state updates.
     */
    let videoClient;
    let activeCall;

    /**
     * Asynchronously connects to the Stream Video service.
     *
     * Steps:
     * 1. Fetches a short-lived Stream token from the backend.
     * 2. Instantiates `StreamVideoClient` with the API key, user info, and token.
     * 3. Retrieves (or creates) the call identified by `order-{id}`.
     * 4. Joins the call, then stores the client and call in React state.
     *
     * @async
     * @returns {Promise<void>}
     */
    async function connectOrderVideo() {
      // Step 1 – Obtain a Stream Video token from the server.
      const token = await apiFetch("/api/stream/token", {
        getToken,
        method: "POST",
      });

      // Step 2 – Initialize the Stream Video client with the returned credentials.
      videoClient = new StreamVideoClient({
        apiKey: token.apiKey,
        user: { id: token.userId, name: token.name },
        token: token.token,
      });

      // Step 3 – Get a reference to the call for this order.
      // The call ID is scoped to the order to ensure participants join the
      // correct room.
      activeCall = videoClient.call("default", `order-${id}`);

      // Step 4 – Join the call, creating it if it does not already exist.
      await activeCall.join({ create: true });

      // Persist the client and call in state so the UI can render the video.
      setClient(videoClient);
      setCall(activeCall);
    }

    // Execute the connection flow; surface any errors as a readable message.
    connectOrderVideo().catch((e) => {
      setError(e instanceof Error ? e.message : "Video failed to start");
    });

    /**
     * Clean-up: runs on unmount or when dependencies change.
     *
     * - `activeCall?.leave()`           – Signals to Stream that the user left.
     * - `videoClient?.disconnectUser()` – Closes the WebSocket connection and
     *                                     frees associated resources.
     *
     * Errors during clean-up are intentionally swallowed because:
     * 1. The component is already unmounting; propagating errors would have
     *    no useful effect.
     * 2. Network-level failures during teardown do not affect the user.
     */
    return () => {
      activeCall?.leave().catch(() => {});
      videoClient?.disconnectUser().catch(() => {});
    };
  }, [paid, id, getToken, isSignedIn]);

  // ─── Return Value ──────────────────────────────────────────────────────────

  /**
   * Expose all state values required by the consuming component to render
   * the order video page correctly.
   */
  return {
    id, // Route param – useful for display or further API calls.
    order, // Full order object for rendering order details.
    paid, // Drives conditional rendering (e.g., paywall vs. video UI).
    isLoading, // Allows the UI to show a loading skeleton.
    loadError, // Allows the UI to render an error state for data fetching.
    client, // Passed to the Stream Video SDK provider/components.
    call, // Passed to the Stream Video SDK call components.
    error, // Surfaces video-connection failures to the user.
  };
}

export default useOrderVideoPage;
