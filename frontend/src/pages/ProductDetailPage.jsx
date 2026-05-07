import { Link } from "react-router";
import {
  ArrowLeftIcon,
  CheckIcon,
  ExternalLinkIcon,
  ShoppingCartIcon,
} from "lucide-react";

import { ProductPageSkeleton } from "../components/LoadingSkeletons";
import { PageError } from "../components/PageError";
import { useProductPage } from "../hooks/useProductPage";
import {
  IK_PRESETS,
  imageKitOptimizedUrl,
  imageKitWatermarkedUrl,
} from "../lib/imagekitUrl";
import { useCart } from "../store/cart";
import { formatPrice } from "../utils/format";

/** Trust/assurance bullet points displayed below the product description. */
const HIGHLIGHTS = [
  "Secure checkout",
  "Support from your order after payment",
  "Specs listed for this catalog",
];

/**
 * Displays the full detail view for a single product.
 * Reads the product slug from the URL, fetches data via `useProductPage`,
 * and renders the image, metadata, price, and cart action.
 */
function ProductDetailPage() {
  const addItem = useCart((s) => s.addItem);
  const { product, isLoading, error } = useProductPage();

  if (isLoading) return <ProductPageSkeleton />;

  if (error || !product) {
    return (
      <PageError
        action={{ to: "/", label: "Back to shop" }}
        message="Product not found."
      />
    );
  }

  const p = product;
  const category = p.category ?? "General";

  // Watermarked URL is used for the "Open full size" external link.
  const watermarkedFullUrl = p.imageUrl
    ? imageKitWatermarkedUrl(p.imageUrl, IK_PRESETS.productHero)
    : null;

  return (
    <div>
      {/* Breadcrumb: Shop → Category → Product name */}
      <nav className="text-sm breadcrumbs text-base-content/60">
        <ul>
          <li>
            <Link to="/">Shop</Link>
          </li>
          <li>
            <Link to={`/?category=${encodeURIComponent(category)}`}>
              {category}
            </Link>
          </li>
          <li className="text-base-content">{p.name}</li>
        </ul>
      </nav>

      <div className="grid gap-10 mt-6 lg:grid-cols-2 lg:gap-14">
        {/* Left column: product image card */}
        <div className="overflow-hidden border shadow-lg card border-base-300 bg-base-100">
          <figure className="aspect-square bg-base-300">
            {p.imageUrl ? (
              <img
                alt=""
                className="object-cover w-full h-full"
                decoding="async"
                fetchPriority="high"
                src={imageKitOptimizedUrl(p.imageUrl, IK_PRESETS.productHero)}
              />
            ) : (
              <div className="w-full h-full" />
            )}
          </figure>

          {/* Footer link to the watermarked full-resolution image */}
          {watermarkedFullUrl ? (
            <div className="flex flex-wrap gap-2 items-center px-3 py-2 border-t border-base-300 bg-base-200/40">
              <a
                className="gap-1 btn btn-ghost btn-xs"
                href={watermarkedFullUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLinkIcon aria-hidden className="size-3.5" />
                Open full size
              </a>
            </div>
          ) : null}
        </div>

        {/* Right column: product details and actions */}
        <div className="flex flex-col text-left">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="badge badge-primary badge-outline">
              {category}
            </span>
            <span className="font-mono text-xs text-base-content/45">
              {p.slug}
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-base-content md:text-4xl">
            {p.name}
          </h1>

          <p className="mt-3 text-3xl font-bold tabular-nums text-primary md:text-4xl">
            {formatPrice(p.priceCents, p.currency)}
          </p>

          <p className="mt-6 text-base leading-relaxed text-base-content/85">
            {p.description}
          </p>

          {/* Purchase highlights / trust signals */}
          <ul className="p-4 mt-6 space-y-2 border rounded-box border-base-300 bg-base-200/50">
            {HIGHLIGHTS.map((h) => (
              <li
                key={h}
                className="flex gap-2 items-center text-sm text-base-content/80"
              >
                <CheckIcon
                  aria-hidden
                  className="size-4 shrink-0 text-success"
                />
                {h}
              </li>
            ))}
          </ul>

          {/* Primary CTA and back navigation */}
          <div className="flex flex-wrap gap-3 mt-8">
            <button
              className="gap-2 shadow-lg btn btn-primary btn-lg"
              type="button"
              onClick={() => addItem(p.id)}
            >
              <ShoppingCartIcon aria-hidden className="size-5" />
              Add to cart
            </button>

            <Link
              className="gap-2 border btn btn-ghost btn-lg border-base-300"
              to="/"
            >
              <ArrowLeftIcon aria-hidden className="size-4" />
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetailPage;
