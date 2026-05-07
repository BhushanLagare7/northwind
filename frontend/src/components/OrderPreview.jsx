import { PackageIcon } from "lucide-react";

import { IK_PRESETS, imageKitOptimizedUrl } from "../lib/imagekitUrl.js";

/** Tailwind size classes for the two supported preview sizes. */
const SIZES = {
  md: "h-[5.5rem] w-[5.5rem]",
  lg: "h-32 w-32 sm:h-36 sm:w-36",
};

/**
 * Displays a visual preview of order items as a thumbnail.
 *
 * - 0 items → placeholder icon
 * - 1 item  → single full image
 * - 2+ items → 2×2 grid (max 4 images, with overflow count badge)
 *
 * @param {Object[]} items        - Array of order item objects to preview
 * @param {string}   [items[].imageUrl] - Optional image URL for the item
 * @param {string}   [items[].slug]     - Unique identifier used as the grid key
 * @param {"md"|"lg"} [size="md"] - Controls thumbnail dimensions and image preset
 */
export function OrderPreview({ items, size = "md" }) {
  const box = SIZES[size] ?? SIZES.md;
  const ikPreset =
    size === "lg" ? IK_PRESETS.orderPreviewLg : IK_PRESETS.orderPreviewMd;

  // Empty state — render a dashed placeholder box with a package icon
  if (!items?.length) {
    return (
      <div
        className={`flex justify-center items-center rounded-2xl border border-dashed shrink-0 border-base-300 bg-base-200/60 ${box}`}
      >
        <PackageIcon
          aria-hidden
          className={
            size === "lg"
              ? "size-12 text-base-content/25"
              : "size-8 text-base-content/25"
          }
        />
      </div>
    );
  }

  // Single item — render a full-bleed image or a fallback icon
  if (items.length === 1) {
    const p = items[0];
    return (
      <div
        className={`overflow-hidden relative rounded-2xl border ring-1 shadow-md shrink-0 border-base-300 bg-base-200 ring-base-300/40 ${box}`}
      >
        {p.imageUrl ? (
          <img
            alt=""
            className="object-cover w-full h-full"
            decoding="async"
            loading="lazy"
            src={imageKitOptimizedUrl(p.imageUrl, ikPreset)}
          />
        ) : (
          <div className="flex justify-center items-center w-full h-full bg-linear-to-br from-base-300 to-base-200">
            <PackageIcon
              aria-hidden
              className={
                size === "lg"
                  ? "size-12 text-base-content/25"
                  : "size-8 text-base-content/25"
              }
            />
          </div>
        )}
      </div>
    );
  }

  // Multi-item grid — show up to 4 images; last cell shows "+N" if items exceed cap
  const cap = 4;
  const show = items.slice(0, cap);
  const rest = items.length > cap ? items.length - cap : 0;

  return (
    <div
      className={`grid shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl border border-base-300 bg-base-200/90 p-0.5 shadow-md ring-1 ring-base-300/40 ${box}`}
    >
      {show.map((p, i) => (
        <div
          key={`${p.slug}-${i}`}
          className="overflow-hidden relative min-h-0 rounded-md bg-base-300"
        >
          {p.imageUrl ? (
            <img
              alt=""
              className="object-cover w-full h-full"
              decoding="async"
              loading="lazy"
              src={imageKitOptimizedUrl(p.imageUrl, ikPreset)}
            />
          ) : (
            <div className="flex justify-center items-center w-full h-full min-h-8">
              <PackageIcon
                aria-hidden
                className="size-4 text-base-content/30"
              />
            </div>
          )}
          {/* Overlay badge on the last cell showing the remaining item count */}
          {i === cap - 1 && rest > 0 ? (
            <div className="flex absolute inset-0 justify-center items-center text-sm font-bold tabular-nums bg-neutral/90 text-neutral-content">
              +{rest}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
