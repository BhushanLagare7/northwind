/**
 * OrderSummaryPage
 *
 * Nested route page rendered inside OrderDetailPage via the <Outlet />.
 * Displays an itemized list of products in the order along with
 * per-line subtotals and the overall order total.
 *
 * Receives `order` and `items` from the parent outlet context
 * (see OrderDetailPage → <Outlet context={{ order, items, paid }} />).
 */

import { Link, useOutletContext } from "react-router";
import { ListOrderedIcon, PackageIcon } from "lucide-react";

import { IK_PRESETS, imageKitOptimizedUrl } from "../lib/imagekitUrl";
import { formatPrice } from "../utils/format";

function OrderSummaryPage() {
  // Pull shared order data provided by the parent route's Outlet context
  const { order, items } = useOutletContext();

  return (
    <div className="overflow-hidden rounded-2xl border shadow-md border-base-300 bg-base-100">
      {/* ── Section header ── */}
      <div className="px-5 py-4 border-b border-base-300 bg-base-200/40 sm:px-6">
        <h2 className="flex gap-2 items-center text-lg font-bold text-base-content">
          <ListOrderedIcon aria-hidden className="size-5 text-primary" />
          Line items
        </h2>
        {/* Dynamic product count label, singular vs plural */}
        <p className="mt-1 text-sm text-base-content/60">
          {items.length} {items.length === 1 ? "product" : "products"} in this
          order
        </p>
      </div>

      {/* ── Line item list ── */}
      <ul className="divide-y divide-base-300">
        {items.map((row) => (
          <li key={row.id} className="px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 sm:justify-between">
              {/* Left side: product thumbnail + details */}
              <div className="flex flex-1 gap-4">
                {/* Thumbnail – links to the product page */}
                <Link
                  className="overflow-hidden relative rounded-xl border ring-1 shadow-sm transition group/img shrink-0 border-base-300 bg-base-200 ring-base-300/30 hover:ring-primary/40"
                  to={`/product/${row.product.slug}`}
                >
                  <div className="w-24 h-24 sm:h-28 sm:w-28">
                    {row.product.imageUrl ? (
                      // Optimised thumbnail via ImageKit preset
                      <img
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover/img:scale-[1.03]"
                        decoding="async"
                        loading="lazy"
                        src={imageKitOptimizedUrl(
                          row.product.imageUrl,
                          IK_PRESETS.orderLineThumb,
                        )}
                      />
                    ) : (
                      // Fallback placeholder when no image is available
                      <div className="flex justify-center items-center w-full h-full bg-linear-to-br from-base-300 to-base-200">
                        <PackageIcon
                          aria-hidden
                          className="size-10 text-base-content/30"
                        />
                      </div>
                    )}
                  </div>
                </Link>

                {/* Product name, category, quantity and unit price */}
                <div className="flex-1 min-w-0">
                  <Link
                    className="text-lg font-semibold leading-snug link link-hover text-base-content"
                    to={`/product/${row.product.slug}`}
                  >
                    {row.product.name}
                  </Link>

                  {/* Category is optional; rendered only when present */}
                  {row.product.category ? (
                    <p className="mt-1 text-sm text-base-content/55">
                      {row.product.category}
                    </p>
                  ) : null}

                  {/* Quantity and per-unit price */}
                  <div className="flex flex-wrap gap-y-1 gap-x-3 items-center mt-2 text-sm text-base-content/65">
                    <span>Qty {row.quantity}</span>
                    <span className="text-base-content/40">·</span>
                    <span>
                      {formatPrice(row.unitPriceCents, row.product.currency)}{" "}
                      each
                    </span>
                  </div>
                </div>
              </div>

              {/* Right side: line subtotal (unit price × quantity) */}
              <div className="flex flex-col pt-3 border-t shrink-0 border-base-300 sm:border-t-0 sm:pt-0 sm:text-right">
                <span className="text-xs font-medium tracking-wide uppercase text-base-content/45">
                  Subtotal
                </span>
                <span className="text-xl font-bold tabular-nums text-base-content">
                  {formatPrice(
                    row.unitPriceCents * row.quantity,
                    row.product.currency,
                  )}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* ── Order total footer ── */}
      <div className="flex gap-4 justify-between items-center px-5 py-5 border-t border-base-300 bg-base-200/50 sm:px-6">
        <span className="text-lg font-semibold text-base-content">Total</span>
        <span className="text-2xl font-bold tabular-nums text-primary">
          {formatPrice(order.totalCents, "usd")}
        </span>
      </div>
    </div>
  );
}

export default OrderSummaryPage;
