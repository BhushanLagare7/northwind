import { Link } from "react-router";
import { ArrowRightIcon, PackageIcon, ShoppingCartIcon } from "lucide-react";

/**
 * Empty Cart
 *
 * Visual empty state for the cart page. When the cart contains no line items,
 * this component appears instead of the item list and order summary.
 */
export default function EmptyCart() {
  return (
    <div className="px-6 py-12 mx-auto max-w-lg text-center rounded-2xl border border-dashed border-base-300 bg-linear-to-b from-base-200/50 to-base-100 sm:px-10 sm:py-16">
      <div className="flex justify-center items-center mx-auto mb-6 rounded-full ring-4 size-20 bg-base-300/60 text-primary/80 ring-base-200/80">
        <ShoppingCartIcon aria-hidden className="size-10" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-base-content sm:text-2xl">
        Your cart is empty
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-base-content/65">
        When you add products from the catalog, they&apos;ll show up here. Ready
        when you are.
      </p>
      <div className="flex flex-col gap-3 items-stretch mt-8 sm:flex-row sm:justify-center">
        <Link className="gap-2 shadow-md btn btn-primary" to="/#catalog">
          Browse catalog
          <ArrowRightIcon aria-hidden className="size-4" />
        </Link>
        <Link
          className="gap-2 border border-white btn btn-ghost bg-base-100 hover:border-primary/35 hover:bg-base-200/50"
          to="/orders"
        >
          <PackageIcon aria-hidden className="size-4" />
          View orders
        </Link>
      </div>
    </div>
  );
}
