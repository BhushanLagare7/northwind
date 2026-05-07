/**
 * OrderDetailPage
 *
 * Displays the full detail view for a single order, including:
 * - Order metadata (ID, date, status, total)
 * - Customer support section with tab navigation
 * - A nested route outlet for Summary and Support Chat tabs
 *
 * Support Chat tab is locked until the order is marked as paid.
 */

import { Link, NavLink, Outlet } from "react-router";
import {
  ArrowLeftIcon,
  HeadphonesIcon,
  LayoutListIcon,
  LockIcon,
  MessageCircleIcon,
} from "lucide-react";

import { OrderDetailSkeleton } from "../components/LoadingSkeletons";
import { PageError } from "../components/PageError";
import { useOrderDetailPage } from "../hooks/useOrderDetailPage.js";
import { formatOrderWhen, formatPrice } from "../utils/format";

/**
 * Returns the CSS class string for a tab NavLink.
 * Applies the `tab-active` modifier when the route is active.
 *
 * @param {{ isActive: boolean }} props - Injected by NavLink
 * @returns {string} Class string for the tab element
 */
const tabClass = ({ isActive }) =>
  `tab gap-2 whitespace-nowrap ${isActive ? "tab-active" : ""}`;

function OrderDetailPage() {
  // Retrieve order data and derived state from the custom hook
  const { id, order, items, paid, isLoading, error } = useOrderDetailPage();

  // Show skeleton UI while data is being fetched
  if (isLoading) {
    return <OrderDetailSkeleton />;
  }

  // Show error state if the fetch failed or the order does not exist
  if (error || !order) {
    return (
      <PageError
        action={{ to: "/orders", label: "Back to orders" }}
        message="Order not found."
      />
    );
  }

  return (
    <div className="space-y-8 text-left">
      {/* Back navigation */}
      <Link
        className="gap-2 px-0 btn btn-ghost btn-sm text-base-content/70 hover:text-primary"
        to="/orders"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Back to orders
      </Link>

      {/* ── Order summary card ── */}
      <div className="overflow-hidden rounded-2xl border shadow-lg border-base-300 bg-base-100">
        {/* Card header: order ID, date, status badge, and total */}
        <div className="px-5 py-6 bg-linear-to-br from-primary/12 via-base-100 to-base-200/90 sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            {/* Left column: order identifier and timestamp */}
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-primary">
                Order details
              </p>

              {/* Short order ID displayed as the page heading */}
              <h1 className="mt-1 font-mono text-2xl font-bold tracking-tight text-base-content sm:text-3xl">
                #{order.id.slice(0, 8)}
              </h1>

              <p className="mt-2 text-sm text-base-content/70">
                {formatOrderWhen(order.createdAt, { dateStyle: "full" })}
              </p>

              {/* Full UUID shown in smaller text for reference */}
              <p className="mt-2 font-mono text-xs break-all text-base-content/45">
                {order.id}
              </p>
            </div>

            {/* Right column: status badge and formatted order total */}
            <div className="flex flex-col gap-3 pt-4 border-t border-base-300/80 lg:border-t-0 lg:pt-0 lg:text-right">
              {/*
               * Badge color logic:
               *   paid              → success (green)
               *   unpaid + pending  → warning (yellow)
               *   unpaid + other    → error   (red)
               */}
              <span
                className={`badge badge-lg w-fit capitalize lg:ml-auto ${
                  paid
                    ? "badge-success"
                    : order.status === "pending"
                      ? "badge-warning"
                      : "badge-error"
                }`}
              >
                {order.status}
              </span>

              <div>
                <p className="text-xs font-medium tracking-wide uppercase text-base-content/50">
                  Order total
                </p>
                <p className="text-2xl font-bold tabular-nums text-base-content sm:text-3xl">
                  {formatPrice(order.totalCents, "usd")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card footer: contextual help message about support access */}
        <div className="px-5 py-4 border-t border-base-300 bg-base-200/40 sm:px-8">
          <p className="max-w-3xl text-sm leading-relaxed text-base-content/80">
            Need help with shipping or returns? Open the{" "}
            <strong className="text-base-content">Support chat</strong> tab
            after payment. Video call links are shared in that thread; everyone
            joins with the same link.
          </p>
        </div>
      </div>

      {/* ── Customer support section ── */}
      <div>
        <div className="flex gap-2 items-center pb-3 border-b border-base-300">
          <HeadphonesIcon aria-hidden className="size-5 text-primary" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-base-content">
            Customer support
          </h2>
        </div>

        {/* Tab bar: Summary is always accessible; Support chat requires payment */}
        <div className="flex-wrap p-1 mt-3 tabs tabs-boxed w-fit bg-base-300/50">
          {/* Summary tab – always active */}
          <NavLink className={tabClass} end to={`/orders/${id}`}>
            <LayoutListIcon aria-hidden className="size-4 shrink-0" />
            Summary
          </NavLink>

          {/* Support chat tab – enabled only after the order is paid */}
          {paid ? (
            <NavLink className={tabClass} to={`/orders/${id}/chat`}>
              <MessageCircleIcon aria-hidden className="size-4 shrink-0" />
              Support chat
            </NavLink>
          ) : (
            // Visually disabled tab shown to unpaid orders
            <span className="gap-2 opacity-50 cursor-not-allowed tab tab-disabled">
              <LockIcon aria-hidden className="size-4 shrink-0" />
              Support chat
            </span>
          )}
        </div>

        {/* Inline warning shown below the tabs for unpaid orders */}
        {!paid ? (
          <div className="mt-4 text-sm alert alert-warning" role="alert">
            <LockIcon aria-hidden className="size-4 shrink-0" />
            <span>
              Support unlocks when this order is marked{" "}
              <strong className="text-base-content">paid</strong> (once payment
              is confirmed).
            </span>
          </div>
        ) : null}

        {/*
         * Nested route outlet.
         * Passes order data down to child routes (Summary, Support Chat)
         * via the Outlet context so they can access it with `useOutletContext`.
         */}
        <div className="mt-5">
          <Outlet context={{ order, items, paid }} />
        </div>
      </div>
    </div>
  );
}

export default OrderDetailPage;
