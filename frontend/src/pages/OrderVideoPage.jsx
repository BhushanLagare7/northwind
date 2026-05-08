import { Link, useNavigate } from "react-router";
import {
  CallControls,
  SpeakerLayout,
  StreamCall,
  StreamTheme,
  StreamVideo,
} from "@stream-io/video-react-sdk";
import { ArrowLeftIcon, VideoIcon } from "lucide-react";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import { OrderVideoSkeleton } from "../components/LoadingSkeletons";
import { PageError } from "../components/PageError";
import useOrderVideoPage from "../hooks/useOrderVideoPage";

/**
 * OrderVideoPage
 * Renders the video support call interface for a specific order.
 * Integrates with Stream Video SDK for real-time communication.
 */
function OrderVideoPage() {
  const navigate = useNavigate();

  // Fetch order access details and initialize the Stream video client/call
  const { id, order, paid, isLoading, loadError, client, call, error } =
    useOrderVideoPage();

  // --- Early Returns: Handle loading, validation, and errors ---

  if (isLoading) {
    return <OrderVideoSkeleton />;
  }

  if (loadError || !order) {
    return (
      <PageError
        action={{ to: "/orders", label: "Back to orders" }}
        message="Order not found or you don't have access."
      />
    );
  }

  if (!paid) {
    return (
      <div className="alert alert-info" role="alert">
        <span>This order must be paid before you can join video support.</span>
      </div>
    );
  }

  if (error) {
    return <PageError message={error} />;
  }

  // Wait for the Stream Video client and call to be fully initialized
  if (!client || !call) {
    return (
      <div className="flex justify-center items-center border min-h-120 rounded-box border-base-300 bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  // --- Main Render: Video Call UI ---

  return (
    <div className="space-y-4 text-left">
      {/* Navigation */}
      <Link
        className="gap-2 btn btn-ghost btn-sm text-base-content/80"
        to={`/orders/${id}/chat`}
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Back to support chat
      </Link>

      {/* Header and Instructions */}
      <div className="border shadow-sm card border-base-300 bg-base-100">
        <div className="flex-row gap-4 items-start card-body">
          <div className="avatar placeholder">
            <div className="flex justify-center items-center w-12 rounded-box bg-secondary/20 text-secondary">
              <VideoIcon aria-hidden className="size-6" />
            </div>
          </div>
          <div>
            <h1 className="text-lg card-title">Video call</h1>
            <p className="text-sm text-base-content/70">
              Same room as the invite link in chat. Allow camera and microphone
              when your browser asks.
            </p>
          </div>
        </div>
      </div>

      {/* Stream SDK Call Interface */}
      <div className="flex overflow-hidden flex-col border min-h-130 rounded-box border-base-300 bg-base-100">
        <StreamVideo client={client}>
          <StreamCall call={call}>
            <StreamTheme className="str-video__theme-custom">
              <div className="flex flex-col flex-1 min-h-0">
                <div className="relative flex-1 min-h-105 bg-neutral text-neutral-content">
                  <SpeakerLayout />
                </div>
                <div className="shrink-0 border-t border-base-300 bg-base-200/90 px-2 py-3 [&_.str-video__call-controls]:flex-wrap [&_.str-video__call-controls]:justify-center">
                  <CallControls
                    onLeave={() => navigate(`/orders/${id}/chat`)}
                  />
                </div>
              </div>
            </StreamTheme>
          </StreamCall>
        </StreamVideo>
      </div>
    </div>
  );
}

export default OrderVideoPage;
