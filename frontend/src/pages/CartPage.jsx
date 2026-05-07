/**
 * CartPage
 *
 * Displays the current user's shopping cart with the ability to:
 * - Adjust item quantities (1–99)
 * - Remove individual items
 * - View a running subtotal
 * - Proceed to checkout (requires sign-in)
 *
 * Renders one of four states:
 *  1. Empty cart  → <EmptyCart />
 *  2. Loading     → <CartSkeleton />
 *  3. Error       → <PageError />
 *  4. Populated   → item list + order summary sidebar
 */
import { Link } from "react-router";
import { Show, SignInButton } from "@clerk/react";
import {
  HeadphonesIcon,
  LogInIcon,
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon,
  Trash2Icon,
} from "lucide-react";

import EmptyCart from "../components/EmptyCart";
import { CartSkeleton } from "../components/LoadingSkeletons";
import { PageError } from "../components/PageError";
import useCartPage from "../hooks/useCartPage";
import { IK_PRESETS, imageKitOptimizedUrl } from "../lib/imagekitUrl";
import { formatPrice } from "../utils/format";

function CartPage() {
  /**
   * useCartPage provides all cart state and actions:
   * - items        : raw cart line items from storage/context
   * - lines        : items enriched with fetched product details
   * - subtotal     : total price in cents across all lines
   * - setQty       : (productId, qty) => void — updates quantity; qty=0 removes
   * - removeItem   : (productId) => void — removes a line entirely
   * - checkout     : initiates the Stripe / payment checkout flow
   * - checkoutLoading, productsLoading, productsError : async states
   */
  const {
    checkout,
    checkoutLoading,
    items,
    lines,
    productsError,
    productsLoading,
    removeItem,
    setQty,
    subtotal,
  } = useCartPage();

  return (
    <div className="text-left">
      <h1 className="flex gap-2 items-center mb-8 text-3xl font-bold text-base-content">
        <ShoppingCartIcon aria-hidden className="size-8 text-primary" />
        Cart
      </h1>

      {/* ── State guards ─────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <EmptyCart />
      ) : productsLoading ? (
        /* Show one skeleton row per cart line while product data loads */
        <CartSkeleton lines={items.length} />
      ) : productsError ? (
        <PageError message="Could not load product details. Refresh the page or try again shortly." />
      ) : (
        /* ── Main layout: item list (left) + order summary (right) ──── */
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* ── Cart item list ───────────────────────────────────────── */}
          <ul className="space-y-4">
            {lines.map(({ line, product: p }) => (
              <li
                key={line.productId}
                className="border shadow-sm card card-side border-base-300 bg-base-100"
              >
                {/* Product thumbnail — falls back to a grey placeholder */}
                <figure className="p-4">
                  {p?.imageUrl ? (
                    <img
                      alt=""
                      className="object-cover w-24 h-24 rounded-box"
                      decoding="async"
                      loading="lazy"
                      src={imageKitOptimizedUrl(
                        p.imageUrl,
                        IK_PRESETS.cartThumb,
                      )}
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-box bg-base-300" />
                  )}
                </figure>

                <div className="flex-row flex-wrap gap-4 justify-between items-center min-w-0 card-body">
                  <div className="flex-1 min-w-0">
                    {/* Product name — links to PDP if product data exists */}
                    <div className="text-base card-title">
                      {p ? (
                        <Link
                          className="link-hover link-primary"
                          to={`/product/${p.slug}`}
                        >
                          {p.name}
                        </Link>
                      ) : (
                        "Unknown product"
                      )}
                    </div>

                    {/* Per-unit price */}
                    {p ? (
                      <p className="text-sm text-base-content/60">
                        {formatPrice(p.priceCents, p.currency)} each
                      </p>
                    ) : null}

                    {/* ── Quantity stepper + remove button ────────────── */}
                    <div className="flex flex-wrap gap-3 items-center mt-2">
                      <span className="text-sm text-base-content/70">Qty</span>
                      <div className="border join border-base-300">
                        {/* Decrease — aria label switches to "Remove" at qty 1 */}
                        <button
                          aria-label={
                            line.quantity <= 1
                              ? "Remove from cart"
                              : "Decrease quantity"
                          }
                          className="btn btn-sm join-item gap-0 px-2.5"
                          type="button"
                          onClick={() =>
                            setQty(line.productId, line.quantity - 1)
                          }
                        >
                          <MinusIcon aria-hidden className="size-4" />
                        </button>

                        {/* Live quantity display for screen readers */}
                        <span
                          aria-live="polite"
                          className="flex justify-center items-center px-3 text-sm font-medium tabular-nums join-item min-w-10 bg-base-200 text-base-content"
                        >
                          {line.quantity}
                        </span>

                        {/* Increase — capped at 99 */}
                        <button
                          aria-label="Increase quantity"
                          className="btn btn-sm join-item gap-0 px-2.5"
                          disabled={line.quantity >= 99}
                          type="button"
                          onClick={() =>
                            setQty(
                              line.productId,
                              Math.min(99, line.quantity + 1),
                            )
                          }
                        >
                          <PlusIcon aria-hidden className="size-4" />
                        </button>
                      </div>

                      {/* Remove entire line */}
                      <button
                        aria-label="Remove from cart"
                        className="btn btn-ghost btn-square btn-sm text-error hover:bg-error/10"
                        title="Remove from cart"
                        type="button"
                        onClick={() => removeItem(line.productId)}
                      >
                        <Trash2Icon aria-hidden className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Line total (unit price × quantity) */}
                  <div className="font-semibold text-right text-base-content">
                    {p
                      ? formatPrice(p.priceCents * line.quantity, p.currency)
                      : "-"}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* ── Order summary sidebar ────────────────────────────────── */}
          <aside className="p-6 border shadow-md card border-base-300 bg-base-100">
            <div className="flex justify-between text-sm">
              <span className="text-base-content/70">Subtotal</span>
              <span className="font-semibold text-base-content">
                {/* Currency derived from the first resolved product line */}
                {formatPrice(subtotal, lines[0]?.product?.currency ?? "usd")}
              </span>
            </div>

            {/* Checkout button — only rendered for authenticated users */}
            <Show when="signed-in">
              <button
                aria-busy={checkoutLoading}
                className="gap-2 mt-6 w-full btn btn-primary"
                disabled={checkoutLoading}
                type="button"
                onClick={checkout}
              >
                {checkoutLoading ? (
                  <span
                    aria-hidden
                    className="loading loading-spinner loading-sm"
                  />
                ) : (
                  <ShoppingCartIcon aria-hidden className="size-4" />
                )}
                {checkoutLoading ? "Opening checkout…" : "Checkout securely"}
              </button>
            </Show>

            {/* Sign-in prompt — shown instead of checkout for guests */}
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button
                  className="gap-2 mt-6 w-full btn btn-outline btn-primary"
                  type="button"
                >
                  <LogInIcon aria-hidden className="size-4" />
                  Sign in to checkout
                </button>
              </SignInButton>
            </Show>

            {/* Post-purchase support hint */}
            <p className="flex gap-2 items-start mt-4 text-xs text-base-content/60">
              <HeadphonesIcon
                aria-hidden
                className="mt-0.5 size-3.5 shrink-0 text-primary"
              />
              <span>
                After payment, open your order for{" "}
                <strong className="text-base-content">support chat</strong>.
                Video invites appear in that thread.
              </span>
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

export default CartPage;
