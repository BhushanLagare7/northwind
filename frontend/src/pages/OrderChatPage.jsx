/**
 * OrderChatPage
 *
 * Nested route page rendered inside OrderDetailPage via the <Outlet />.
 * Provides a real-time support chat interface for a specific order using
 * the Stream Chat SDK (stream-chat-react).
 *
 * Features:
 * - Gated behind payment status (unpaid orders see a prompt instead)
 * - Support agents with invite permission can send a video call link
 * - Full messaging UI: message list, input, threaded replies, and header
 *
 * State and side-effects are managed by the `useOrderChatPage` hook.
 */

import { HeadphonesIcon, VideoIcon } from "lucide-react";
import {
  Channel,
  ChannelHeader,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";

import "stream-chat-react/dist/css/v2/index.css";
import { OrderChatPanelSkeleton } from "../components/LoadingSkeletons.jsx";
import { PageError } from "../components/PageError.jsx";
import { useOrderChatPage } from "../hooks/useOrderChatPage.js";

function OrderChatPage() {
  // Destructure chat state and actions from the custom hook
  const { paid, client, error, channel, canInvite, inviteMutation } =
    useOrderChatPage();

  // Guard: order must be paid before support chat is accessible
  if (!paid) {
    return (
      <p className="text-base-content/60">
        Complete payment to open support chat.
      </p>
    );
  }

  // Show a descriptive error if the chat channel could not be initialized
  if (error) {
    return <PageError message={error} />;
  }

  // Show skeleton while the Stream client or channel is still loading
  if (!client || !channel) {
    return <OrderChatPanelSkeleton />;
  }

  return (
    <div className="space-y-4 text-left">
      {/* ── Info card: context and optional video call invite ── */}
      <div className="border shadow-sm card border-base-300 bg-base-100">
        <div className="flex-row flex-wrap gap-4 items-start card-body">
          {/* Icon avatar */}
          <div className="avatar placeholder">
            <div className="flex justify-center items-center w-12 rounded-box bg-primary/20 text-primary">
              <HeadphonesIcon aria-hidden className="size-6" />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-base card-title">Message support</h3>
            <p className="text-sm text-base-content/70">
              Ask about this order, shipping, or returns. Support can send a
              video call link here when needed; both sides use the same Join
              button.
            </p>

            {/* Video invite controls – only rendered for users with invite permission */}
            {canInvite ? (
              <div className="flex flex-wrap gap-2 items-center mt-3">
                <button
                  className="gap-2 btn btn-secondary btn-sm"
                  disabled={inviteMutation.isPending}
                  type="button"
                  onClick={() => inviteMutation.mutate()}
                >
                  {/* Swap icon for a spinner while the mutation is in-flight */}
                  {inviteMutation.isPending ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <VideoIcon aria-hidden className="size-4" />
                  )}
                  Send video call invite
                </button>

                {/* Inline mutation feedback messages */}
                {inviteMutation.isError ? (
                  <span className="text-sm text-error">
                    Could not send invite.
                  </span>
                ) : null}

                {inviteMutation.isSuccess ? (
                  <span className="text-sm text-success">Invite sent.</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/*
       * ── Stream Chat panel ──
       * Fixed height with overflow hidden to keep the panel self-scrolling.
       * The Stream SDK components handle real-time messaging internally:
       *   Chat        – provides the client context to all child components
       *   Channel     – scopes the UI to the specific order channel
       *   Window      – layout wrapper for header, message list, and input
       *   Thread      – renders threaded reply view alongside the main window
       */}
      <div className="stream-panel h-140 overflow-hidden rounded-box border border-neutral-700 bg-neutral-950 [&_.str-chat\_\_main-panel]:min-h-0">
        <Chat client={client} theme="messaging str-chat__theme-dark">
          <Channel channel={channel}>
            <Window>
              <ChannelHeader />
              <MessageList />
              {/* Auto-focus the input so users can type immediately */}
              <MessageInput focus />
            </Window>
            <Thread />
          </Channel>
        </Chat>
      </div>
    </div>
  );
}

export default OrderChatPage;
