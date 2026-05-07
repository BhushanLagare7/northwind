import { Link } from "react-router";
import { ChevronRightIcon, PackageIcon } from "lucide-react";

import { OrdersListSkeleton } from "../components/LoadingSkeletons";
import { OrderPreview } from "../components/OrderPreview";
import { PageError } from "../components/PageError";
import useOrdersPage from "../hooks/useOrdersPage";
import { formatOrderWhen, formatPrice } from "../utils/format";

/**
 * Displays a list of orders for the current user or all store orders for staff.
 *
 * Handles three page states:
 * - Loading → skeleton placeholders
 * - Error   → error message with a link back to the shop
 * - Success → list of clickable order cards, or an empty state prompt
 */
function OrdersPage() {
  const { isLoading, error, orders, staff } = useOrdersPage();

  // Loading state — show skeleton placeholders while data is being fetched
  if (isLoading) {
    return (
      <div className="text-left">
        <div className="mb-2 w-64 max-w-full h-10 skeleton" />
        <div className="mb-8 w-96 max-w-full h-4 skeleton" />
        <OrdersListSkeleton />
      </div>
    );
  }

  // Error state — show a generic error message with a navigation fallback
  if (error) {
    return (
      <PageError
        action={{ to: "/", label: "Back to shop" }}
        message="Could not load orders."
      />
    );
  }

  return (
    <div className="text-left">
      {/* Page heading — label differs for staff vs. regular users */}
      <h1 className="flex gap-2 items-center mb-2 text-3xl font-bold text-base-content">
        <PackageIcon aria-hidden className="size-8 text-primary" />
        {staff ? "Orders" : "Your orders"}
      </h1>

      {/* Subtitle — context-aware description based on user role */}
      <p className="mb-8 text-sm text-base-content/70">
        {staff
          ? "All store orders. Open one for customer support chat."
          : "Paid orders include customer support: open an order for chat."}
      </p>

      {orders.length === 0 ? (
        // Empty state — prompt the user to browse the shop
        <p className="text-base-content/70">
          No orders yet.{" "}
          <Link className="link link-primary" to="/">
            Browse the shop
          </Link>
        </p>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => {
            const previewItems = o.previewItems ?? [];

            // Total quantity across all line items in this order
            const totalUnits = previewItems.reduce(
              (sum, row) => sum + row.quantity,
              0,
            );
            const lineCount = previewItems.length;

            // Human-readable summary: "No line items" | "N items" | "N products · N items"
            const summary =
              lineCount === 0
                ? "No line items"
                : lineCount === 1
                  ? `${totalUnits} ${totalUnits === 1 ? "item" : "items"}`
                  : `${lineCount} products · ${totalUnits} items`;

            return (
              <li key={o.id}>
                {/* Each order is a full-card link navigating to the order detail page */}
                <Link
                  className="border shadow-sm transition group card border-base-300 bg-base-100 hover:border-primary/45 hover:shadow-md"
                  to={`/orders/${o.id}`}
                >
                  <div className="flex-row flex-wrap gap-4 items-center py-5 card-body sm:gap-5">
                    <OrderPreview items={previewItems} />

                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2 items-center">
                        {/* Truncated order ID shown in monospace for readability */}
                        <span className="font-mono text-xs text-base-content/55 sm:text-sm">
                          {o.id.slice(0, 8)}…
                        </span>

                        {/* Status badge — color-coded by order status */}
                        <span
                          className={`badge badge-sm capitalize ${
                            o.status === "paid"
                              ? "badge-success"
                              : o.status === "pending"
                                ? "badge-warning"
                                : "badge-error"
                          }`}
                        >
                          {o.status}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-base-content/60">
                        {formatOrderWhen(o.createdAt)}
                      </p>

                      <p className="mt-2 text-sm text-base-content/75">
                        {summary}
                      </p>
                    </div>

                    <div className="flex gap-3 items-center shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-medium tracking-wide uppercase text-base-content/50">
                          Total
                        </p>
                        <p className="text-lg font-bold tabular-nums text-base-content sm:text-xl">
                          {formatPrice(o.totalCents, "usd")}
                        </p>
                      </div>
                      <ChevronRightIcon
                        aria-hidden
                        className="size-5 shrink-0 text-base-content/40 transition group-hover:translate-x-0.5 group-hover:text-primary"
                      />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default OrdersPage;
