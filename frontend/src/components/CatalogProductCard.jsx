import { Link } from "react-router";
import { PlusIcon } from "lucide-react";

import { IK_PRESETS, imageKitOptimizedUrl } from "../lib/imagekitUrl.js";
import { useCart } from "../store/cart.js";
import { formatPrice } from "../utils/format.js";

/**
 * Displays a product preview card for the catalog grid.
 * Includes image, category badge, details, and an "Add to Cart" action.
 */
export function CatalogProductCard({ product }) {
  const addItem = useCart((s) => s.addItem);

  return (
    <article className="card group h-full overflow-hidden border border-base-300 bg-base-100 shadow-md transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl">
      {/* Product Image & Category Link */}
      <Link
        className="block overflow-hidden relative"
        to={`/product/${product.slug}`}
      >
        <figure className="aspect-4/3 bg-base-300">
          {product.imageUrl ? (
            <img
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              decoding="async"
              loading="lazy"
              src={imageKitOptimizedUrl(
                product.imageUrl,
                IK_PRESETS.catalogCard,
              )}
            />
          ) : null}
        </figure>
        <span className="absolute top-3 left-3 text-xs font-medium border-0 backdrop-blur badge badge-sm bg-base-100/90 text-base-content/80">
          {product.category ?? "General"}
        </span>
      </Link>

      <div className="gap-3 p-5 text-left card-body grow">
        {/* Title and Description */}
        <Link
          className="text-lg transition card-title line-clamp-2 group-hover:text-primary"
          to={`/product/${product.slug}`}
        >
          {product.name}
        </Link>
        <p className="text-sm leading-relaxed line-clamp-3 text-base-content/70">
          {product.description}
        </p>

        {/* Footer: Price and Cart Action */}
        <div className="justify-between items-center pt-4 mt-auto border-t card-actions border-base-200">
          <span className="text-lg font-bold tabular-nums text-base-content">
            {formatPrice(product.priceCents, product.currency)}
          </span>
          <button
            className="gap-1 shadow btn btn-primary btn-sm"
            type="button"
            onClick={() => addItem(product.id)}
          >
            <PlusIcon aria-hidden className="size-4" />
            Add
          </button>
        </div>
      </div>
    </article>
  );
}
