import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, PackageIcon } from "lucide-react";

import { useCart } from "../store/cart";

/**
 * Confirmation page shown after a successful Polar Pay checkout redirect.
 *
 * On mount:
 * - Clears the local cart
 * - Invalidates the cached orders query to trigger a fresh fetch
 */
function CheckoutReturnPage() {
  const clearCart = useCart((s) => s.clear);

  const [params] = useSearchParams();
  // Polar Pay appends checkout_id to the return URL — displayed for reference
  const checkoutId = params.get("checkout_id");

  const queryClient = useQueryClient();

  // Clear the cart and refresh orders once when the page mounts
  useEffect(() => {
    clearCart();
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  }, [queryClient, clearCart]);

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mx-auto mb-4 avatar placeholder">
        <div className="flex justify-center items-center w-16 rounded-full bg-success/20 text-success">
          <CheckCircle2Icon aria-hidden className="size-10" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-base-content">
        Thanks for your order
      </h1>

      <p className="mt-4 text-base-content/70">
        Your order is created after payment is confirmed. Open it from your
        orders list for{" "}
        <strong className="text-base-content">support chat</strong> (it appears
        there as <strong className="text-base-content">paid</strong>).
        We&apos;ll send video invites in that thread when needed.
      </p>

      {/* Show the Polar Pay checkout ID if present in the URL */}
      {checkoutId ? (
        <p className="mt-2 font-mono text-xs text-base-content/50">
          Checkout: {checkoutId}
        </p>
      ) : null}

      <Link className="gap-2 mt-8 btn btn-primary" to="/orders">
        <PackageIcon aria-hidden className="size-4" />
        View orders
      </Link>
    </div>
  );
}

export default CheckoutReturnPage;
