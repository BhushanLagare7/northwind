/**
 * @fileoverview Custom hook for managing the order chat page functionality.
 * Handles Stream Chat client initialization, user connection, and video invite
 * capabilities for a specific order's chat interface.
 *
 * @module useOrderChatPage
 */

import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router";
import { useAuth } from "@clerk/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { StreamChat } from "stream-chat";

import { apiFetch } from "../lib/api.js";

/**
 * @typedef {Object} OrderChatPageResult
 * @property {boolean}        paid          - Whether the order has been paid for.
 *                                            Determines if chat access is allowed.
 * @property {StreamChat|null} client       - The initialized Stream Chat client instance,
 *                                            or null if not yet connected.
 * @property {string|null}    error         - An error message if the chat failed to load,
 *                                            or null if there is no error.
 * @property {Channel|null}   channel       - The Stream Chat channel for the current order,
 *                                            or null if the client is not connected.
 * @property {boolean}        canInvite     - Whether the current user has permission to
 *                                            send video call invites (support/admin only).
 * @property {UseMutationResult} inviteMutation - React Query mutation object for triggering
 *                                               a video invite for the current order.
 */

/**
 * Custom hook that manages the chat functionality for a specific order page.
 *
 * @description
 * This hook handles the full lifecycle of a Stream Chat connection for an order:
 * - Fetches the current user's role to determine permissions.
 * - Initializes and connects a Stream Chat client when the order is paid.
 * - Watches the order-specific chat channel.
 * - Provides a mutation to send video call invites (restricted to support/admin roles).
 * - Cleans up the chat connection when the component unmounts or dependencies change.
 *
 * @requires The component using this hook must:
 * - Be wrapped in a Clerk authentication provider.
 * - Have access to a React Router outlet context exposing a `paid` boolean.
 * - Be rendered under a route that provides an `id` param (the order ID).
 *
 * @example
 * // Basic usage inside a page component
 * function OrderChatPage() {
 *   const {
 *     paid,
 *     client,
 *     error,
 *     channel,
 *     canInvite,
 *     inviteMutation,
 *   } = useOrderChatPage();
 *
 *   if (error) return <ErrorMessage message={error} />;
 *   if (!paid)  return <PaymentRequired />;
 *   if (!client) return <LoadingSpinner />;
 *
 *   return (
 *     <div>
 *       <Chat client={client}>
 *         <Channel channel={channel}>
 *           <MessageList />
 *           <MessageInput />
 *         </Channel>
 *       </Chat>
 *       {canInvite && (
 *         <button onClick={() => inviteMutation.mutate()}>
 *           Send Video Invite
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 *
 * @returns {OrderChatPageResult} An object containing the chat client, channel,
 *                                error state, payment status, invite permissions,
 *                                and the invite mutation handler.
 */
export function useOrderChatPage() {
  /** @type {string} id - The order ID extracted from the current route parameters. */
  const { id } = useParams();

  /**
   * Clerk authentication utilities.
   * @type {{ getToken: Function, isSignedIn: boolean }}
   */
  const { getToken, isSignedIn } = useAuth();

  /**
   * Outlet context provided by the parent route.
   * @type {{ paid: boolean }}
   */
  const { paid } = useOutletContext();

  /**
   * The Stream Chat client instance.
   * Null until a successful connection is established.
   * @type {[StreamChat|null, Function]}
   */
  const [client, setClient] = useState(null);

  /**
   * Stores any error message that occurs during chat initialization.
   * Null when there is no error.
   * @type {[string|null, Function]}
   */
  const [error, setError] = useState(null);

  /**
   * Fetches the currently authenticated user's profile data, including their role.
   * Only runs when the user is signed in.
   *
   * @type {{ data: { user: { role: string } } | undefined }}
   */
  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/me", { getToken }),
    enabled: isSignedIn,
  });

  /**
   * The authenticated user's role (e.g., "customer", "support", "admin").
   * Undefined until `meData` resolves.
   * @type {string|undefined}
   */
  const role = meData?.user?.role;

  /**
   * Mutation for sending a video call invite for the current order.
   * POSTs to the video-invite endpoint; restricted to support and admin roles
   * via the `canInvite` flag returned from this hook.
   *
   * @type {UseMutationResult}
   */
  const inviteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/orders/${id}/video-invite`, { getToken, method: "POST" }),
  });

  /**
   * Effect that initializes the Stream Chat connection for the current order.
   *
   * @description
   * Runs when `paid`, `id`, or `getToken` changes. The effect will:
   * 1. Early-return (no-op) if the order is not paid or the ID is missing.
   * 2. Create the order's Stream channel on the server via a POST request.
   * 3. Fetch a short-lived Stream Chat token from the backend.
   * 4. Initialize the StreamChat singleton with the API key from the token.
   * 5. Connect the authenticated user to Stream Chat.
   * 6. Start watching the order-specific messaging channel.
   * 7. Update local state with the connected client.
   *
   * On cleanup (unmount or dependency change), disconnects the chat user
   * to prevent memory leaks and stale connections.
   *
   * @listens {boolean} paid     - Chat only initializes for paid orders.
   * @listens {string}  id       - Re-initializes if the order ID changes.
   * @listens {Function} getToken - Re-initializes if the auth token getter changes.
   */
  useEffect(() => {
    // Do not initialize chat for unpaid orders or if the order ID is absent
    if (!paid || !id) return undefined;

    /** @type {StreamChat|undefined} chatClient - Local reference for cleanup. */
    let chatClient;

    /**
     * Asynchronously establishes the Stream Chat connection for the order.
     *
     * @async
     * @function connectOrderChat
     * @throws {Error} If any API call or Stream Chat operation fails.
     */
    async function connectOrderChat() {
      // Ensure the server-side Stream channel exists for this order
      await apiFetch(`/api/orders/${id}/stream-channel`, {
        method: "POST",
        getToken,
      });

      /**
       * Retrieve a scoped Stream Chat token from the backend.
       * @type {{ apiKey: string, userId: string, name: string, token: string }}
       */
      const token = await apiFetch("/api/stream/token", {
        getToken,
        method: "POST",
      });

      // Initialize the StreamChat singleton using the API key from the token
      chatClient = StreamChat.getInstance(token.apiKey);

      // Connect the current user to Stream Chat with their identity and token
      await chatClient.connectUser(
        { id: token.userId, name: token.name },
        token.token,
      );

      // Obtain and start watching the order-specific messaging channel
      const channel = chatClient.channel("messaging", `order-${id}`);
      await channel.watch();

      // Expose the connected client via state
      setClient(chatClient);
    }

    connectOrderChat().catch((e) => {
      // Normalize error to a human-readable string and store it in state
      setError(e instanceof Error ? e.message : "Chat failed to load");
    });

    /**
     * Cleanup function: disconnects the Stream Chat user when the effect
     * re-runs or the component unmounts, preventing connection leaks.
     *
     * @returns {void}
     */
    return () => {
      if (chatClient) {
        chatClient.disconnectUser();
      }
    };
  }, [paid, id, getToken]);

  /**
   * The active Stream Chat channel for this order.
   * Derived from the connected client and the current order ID.
   * Returns null if the client has not connected yet.
   *
   * @type {Channel|null}
   */
  const channel =
    client && id ? client.channel("messaging", `order-${id}`) : null;

  /**
   * Whether the current user is allowed to send video invites.
   * Only "support" and "admin" roles have this permission.
   *
   * @type {boolean}
   */
  const canInvite = role === "support" || role === "admin";

  return { paid, client, error, channel, canInvite, inviteMutation };
}
