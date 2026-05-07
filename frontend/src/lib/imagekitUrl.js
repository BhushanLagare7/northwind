/**
 * @fileoverview ImageKit URL transformation utilities for on-the-fly image optimization.
 *
 * ## Overview
 * Image optimization is critical for web application performance. Optimized images:
 *  - Load faster and consume less bandwidth
 *  - Improve overall user experience and Core Web Vitals
 *  - Reduce bounce rates and positively impact business metrics
 *
 * ## Architecture / Main Idea
 * Rather than storing multiple pre-resized copies of every image, we store a single
 * original image URL in the database and use ImageKit's URL-based transformation API
 * to generate optimized variants on-the-fly for each UI context.
 *
 * ## Usage Examples by UI Context
 * | UI Context         | Preset            | Dimensions      |
 * |--------------------|-------------------|-----------------|
 * | Catalog card       | `catalogCard`     | 800 × 600 px    |
 * | Product detail     | `productHero`     | 1200 × 1200 px  |
 * | Cart thumbnail     | `cartThumb`       | 192 × 192 px    |
 * | Admin table row    | `adminThumb`      | 144 × 144 px    |
 * | Order summary      | `orderLineThumb`  | 224 × 224 px    |
 *
 * @example
 * // Basic usage with a preset
 * import { imageKitOptimizedUrl, IK_PRESETS } from "./imagekit";
 * const src = imageKitOptimizedUrl(product.imageUrl, IK_PRESETS.catalogCard);
 *
 * @example
 * // Custom transformation
 * const src = imageKitOptimizedUrl(product.imageUrl, { w: 400, h: 300, q: 85 });
 *
 * @example
 * // Watermarked URL for sharing / downloading
 * const shareUrl = imageKitWatermarkedUrl(product.imageUrl, IK_PRESETS.productHero);
 *
 * @see https://imagekit.io/docs/image-optimization
 * @see https://imagekit.io/docs/image-resize-and-crop
 * @see https://imagekit.io/docs/add-overlays-on-images
 */

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Builds an ImageKit **text overlay** layer string that renders the "Northwind"
 * brand watermark in the top-right corner of the image.
 *
 * The font size scales automatically with the larger of the requested width or
 * height so the watermark remains legible but not overwhelming across all preset
 * sizes (thumbnail → hero).
 *
 * The resulting string is intended to be chained onto a base transformation
 * segment using ImageKit's colon (`:`) chaining syntax.
 *
 * @private
 * @param {{ w: number | null | undefined; h: number | null | undefined }} dims
 *   The target output dimensions used to calculate the appropriate font size.
 *   Either value may be `null` / `undefined` / `0`; the function treats those
 *   as "not set" and falls back to a minimum of 200 px for scaling purposes.
 * @returns {string} An ImageKit layer transformation string, e.g.
 *   `"l-text,i-Northwind,fs-16,co-FFFFFF,bg-0F172A90,pa-8_12,lx-N14,ly-14,lap-top_right,l-end"`
 *
 * @see https://imagekit.io/docs/add-overlays-on-images
 *
 * @example
 * buildNorthwindTextLayer({ w: 800, h: 600 });
 * // => "l-text,i-Northwind,fs-22,co-FFFFFF,bg-0F172A90,pa-8_12,lx-N14,ly-14,lap-top_right,l-end"
 */
function buildNorthwindTextLayer({ w, h }) {
  // Determine the largest output dimension to scale the font against.
  // Clamp each dimension to 0 if absent, and enforce a minimum of 200 so tiny
  // thumbnails still get a readable (if small) watermark.
  const maxDim = Math.max(
    w != null && w > 0 ? w : 0,
    h != null && h > 0 ? h : 0,
    200, // absolute floor — prevents fs from going below the ≤180 branch
  );

  // Font-size ladder: maps output size ranges → readable-but-unobtrusive sizes.
  let fs = 28; // default (overwritten by every branch below)
  if (maxDim <= 180)
    fs = 11; // admin/cart tiny thumbs
  else if (maxDim <= 240)
    fs = 13; // small order preview tiles
  else if (maxDim <= 400)
    fs = 16; // medium catalog cards
  else if (maxDim <= 700)
    fs = 22; // large catalog / order hero
  else fs = 30; // full product hero (1200 px+)

  // ImageKit text-layer syntax reference:
  //   l-text          → open text layer
  //   i-Northwind     → text content
  //   fs-{n}          → font size in px
  //   co-FFFFFF       → white text color (hex, no #)
  //   bg-0F172A90     → semi-transparent dark background (hex + alpha byte)
  //   pa-8_12         → padding: 8 px vertical, 12 px horizontal
  //   lx-N14,ly-14    → position: 14 px inset from right (N = negative), 14 px from top
  //   lap-top_right   → layer anchor point: top-right corner
  //   l-end           → close layer
  return `l-text,i-Northwind,fs-${fs},co-FFFFFF,bg-0F172A90,pa-8_12,lx-N14,ly-14,lap-top_right,l-end`;
}

/**
 * Builds the ImageKit `tr:` **transformation path segment** that encodes
 * resize, crop, quality, and format parameters into a URL-safe string.
 *
 * The segment is inserted into the ImageKit delivery URL just before the
 * image path so ImageKit's CDN applies the transformations server-side before
 * sending bytes to the browser.
 *
 * ### Crop strategy
 * When both `w` and `h` are supplied, ImageKit's default crop mode is
 * `c-maintain_ratio` (centre-crop / fill). For product photography we prefer
 * `c-at_max` instead: the entire image fits inside the bounding box without
 * any pixels being cropped away, and CSS `object-cover` handles visual
 * framing in the browser. Pass `crop: "maintain_ratio"` to override when a
 * hard-cropped square thumbnail is needed (e.g. social-share cards).
 *
 * ### Watermark chaining
 * When `watermark: true`, the text-overlay layer produced by
 * {@link buildNorthwindTextLayer} is appended after the base segment using
 * ImageKit's colon (`:`) chained-transformation syntax.
 *
 * @private
 * @param {object}  opts                 - Transformation options.
 * @param {number}  [opts.w]             - Output width in logical pixels. Omit to keep aspect ratio.
 * @param {number}  [opts.h]             - Output height in logical pixels. Omit to keep aspect ratio.
 * @param {number}  [opts.q=80]          - JPEG/WebP quality (1–100). Defaults to 80.
 * @param {string}  [opts.f="auto"]      - Output format. `"auto"` lets ImageKit choose the best
 *                                         modern format (WebP, AVIF) based on the browser's
 *                                         `Accept` header.
 * @param {"at_max"|"maintain_ratio"} [opts.crop] - Crop / fit mode when both `w` and `h` are set.
 *                                         Defaults to `"at_max"` (letterbox / no crop).
 * @param {boolean} [opts.watermark=false] - When `true`, appends the Northwind brand text overlay.
 * @returns {string} An ImageKit transformation path segment, e.g.
 *   `"tr:w-800,h-600,c-at_max,q-80,f-auto"` or with a watermark:
 *   `"tr:w-800,h-600,c-at_max,q-80,f-auto:l-text,i-Northwind,...,l-end"`
 *
 * @see https://imagekit.io/docs/image-optimization
 * @see https://imagekit.io/docs/image-resize-and-crop
 *
 * @example
 * buildTrSegment({ w: 800, h: 600 });
 * // => "tr:w-800,h-600,c-at_max,q-80,f-auto"
 *
 * @example
 * buildTrSegment({ w: 800, h: 600, watermark: true });
 * // => "tr:w-800,h-600,c-at_max,q-80,f-auto:l-text,i-Northwind,fs-22,...,l-end"
 */
function buildTrSegment({ w, h, q = 80, f = "auto", crop, watermark = false }) {
  const parts = [];

  // Dimensions — only included when explicitly provided and positive
  if (w != null && w > 0) parts.push(`w-${Math.round(w)}`);
  if (h != null && h > 0) parts.push(`h-${Math.round(h)}`);

  // Crop mode — only meaningful when both dimensions are constrained.
  // Default to "at_max" (fit-inside / letterbox) so no pixels are cropped
  // server-side; CSS object-cover handles the visual fill in the browser.
  if (w != null && w > 0 && h != null && h > 0) {
    const mode = crop ?? "at_max";
    parts.push(`c-${mode}`);
  }

  // Quality — clamped to the valid 1–100 range to prevent malformed URLs
  parts.push(`q-${Math.min(100, Math.max(1, Math.round(q)))}`);

  // Format — "auto" instructs ImageKit to serve WebP/AVIF when supported
  parts.push(`f-${f}`);

  const base = `tr:${parts.join(",")}`;

  // Optionally chain the brand watermark layer after the base transforms
  if (!watermark) return base;
  return `${base}:${buildNorthwindTextLayer({ w, h })}`;
}

/**
 * Determines whether a given URL is served by an ImageKit delivery endpoint,
 * either via ImageKit's shared CDN (`ik.imagekit.io`) or a custom domain
 * configured through the `VITE_IMAGEKIT_URL_ENDPOINT` environment variable.
 *
 * Only URLs that pass this check are transformed by {@link imageKitOptimizedUrl};
 * legacy or third-party image URLs are passed through unchanged.
 *
 * @private
 * @param {string} url - The absolute URL to test.
 * @returns {boolean} `true` if the URL belongs to an ImageKit endpoint, `false` otherwise.
 *
 * @example
 * isImageKitDeliveryUrl("https://ik.imagekit.io/demo/sample.jpg"); // true
 * isImageKitDeliveryUrl("https://example.com/photo.jpg");          // false
 */
function isImageKitDeliveryUrl(url) {
  try {
    const u = new URL(url);

    // Case 1: standard ImageKit shared CDN subdomain
    if (u.hostname.endsWith("ik.imagekit.io")) return true;

    // Case 2: custom ImageKit endpoint (e.g. images.mystore.com)
    // configured via the Vite environment variable VITE_IMAGEKIT_URL_ENDPOINT.
    // Trailing slash is stripped before the prefix check.
    const endpoint = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT?.replace(
      /\/$/,
      "",
    );
    if (endpoint && url.startsWith(endpoint)) return true;

    return false;
  } catch {
    // new URL() throws on relative or malformed URLs — treat as non-ImageKit
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns an ImageKit **optimized delivery URL** for the given image, applying
 * resize, crop, quality, and format transformations via ImageKit's URL API.
 *
 * ### How it works
 * ImageKit encodes transformations directly in the URL path as a `tr:…` segment
 * placed between the account identifier and the image path. This function:
 * 1. Validates that the URL is served by an ImageKit endpoint.
 * 2. Strips any existing `tr:…` segment (prevents double-transformation).
 * 3. Injects a freshly built transformation segment.
 * 4. Returns the modified URL string.
 *
 * Non-ImageKit URLs (legacy CDNs, external images) are returned **unchanged**
 * so the function is safe to call unconditionally in render code.
 *
 * ### URL formats handled
 * | Format | Example |
 * |--------|---------|
 * | Shared CDN | `https://ik.imagekit.io/{accountId}/{path}` |
 * | Custom endpoint | `https://images.mystore.com/{path}` (via `VITE_IMAGEKIT_URL_ENDPOINT`) |
 *
 * @param {string | null | undefined} url
 *   The original image URL stored in the database. `null` / `undefined` / `""`
 *   are returned as-is so the function is null-safe.
 * @param {object}  [opts={}]              - ImageKit transformation options.
 * @param {number}  [opts.w]               - Output width in logical pixels.
 * @param {number}  [opts.h]               - Output height in logical pixels.
 * @param {number}  [opts.q=80]            - Quality (1–100).
 * @param {string}  [opts.f="auto"]        - Output format (`"auto"` | `"webp"` | `"jpg"` | …).
 * @param {"at_max"|"maintain_ratio"} [opts.crop] - Crop / fit mode (both dims required).
 * @param {boolean} [opts.watermark=false] - Append brand watermark overlay.
 * @returns {string | undefined}
 *   The transformed ImageKit URL, the original URL (if not an ImageKit URL),
 *   or `undefined` if the input was `null`.
 *
 * @example <caption>Catalog card with a preset</caption>
 * imageKitOptimizedUrl(product.imageUrl, IK_PRESETS.catalogCard);
 * // "https://ik.imagekit.io/demo/tr:w-800,h-600,c-at_max,q-80,f-auto/photo.jpg"
 *
 * @example <caption>Null-safe usage in JSX</caption>
 * <img src={imageKitOptimizedUrl(product.imageUrl, { w: 400 })} alt="product" />
 *
 * @example <caption>External / legacy URL — returned unchanged</caption>
 * imageKitOptimizedUrl("https://legacy-cdn.example.com/img.jpg", { w: 400 });
 * // "https://legacy-cdn.example.com/img.jpg"
 */
export function imageKitOptimizedUrl(url, opts = {}) {
  // Guard: treat null / undefined / empty string as no-op
  if (url == null || url === "") return url ?? undefined;

  // Guard: only transform ImageKit-hosted URLs; pass everything else through
  if (typeof url !== "string" || !isImageKitDeliveryUrl(url)) return url;

  const tr = buildTrSegment(opts);

  try {
    const u = new URL(url);

    // ------------------------------------------------------------------
    // Branch A: standard ImageKit shared CDN (ik.imagekit.io)
    // URL structure: https://ik.imagekit.io/{accountId}/[tr:…/]{imagePath}
    // ------------------------------------------------------------------
    if (u.hostname.endsWith("ik.imagekit.io")) {
      const segments = u.pathname.split("/").filter(Boolean);

      // Minimum valid path: /{accountId}/{imageName} → 2 segments
      if (segments.length < 2) return url;

      const id = segments[0]; // ImageKit account / endpoint ID
      const rest = segments.slice(1); // everything after the account ID

      // Strip any pre-existing transformation segments to avoid stacking
      // e.g. ["tr:w-400,h-300", "products", "shoe.jpg"] → ["products", "shoe.jpg"]
      while (rest.length && rest[0].toLowerCase().startsWith("tr")) {
        rest.shift();
      }

      // Safety: bail if stripping left us with no image path
      if (!rest.length) return url;

      // Rebuild: /{accountId}/{newTransform}/{imagePath}
      u.pathname = `/${id}/${tr}/${rest.join("/")}`;
      return u.toString();
    }

    // ------------------------------------------------------------------
    // Branch B: custom ImageKit endpoint (VITE_IMAGEKIT_URL_ENDPOINT)
    // URL structure: https://images.mystore.com/[tr:…/]{imagePath}
    // ------------------------------------------------------------------
    const endpoint = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT?.replace(
      /\/$/,
      "",
    );

    if (endpoint && url.startsWith(endpoint)) {
      const epUrl = new URL(endpoint);

      // Extract the base path of the custom endpoint (may be "" or "/store/images")
      const basePath = epUrl.pathname.replace(/\/$/, "") || "";

      // Sanity check: the image URL's path must actually start with the endpoint's base path
      if (!u.pathname.startsWith(basePath)) return url;

      // Isolate the image-relative path (everything after the endpoint base)
      const rel = u.pathname.slice(basePath.length).replace(/^\//, "");
      const relSegs = rel.split("/").filter(Boolean);

      // Strip any pre-existing transformation segments (same logic as Branch A)
      while (relSegs.length && relSegs[0].toLowerCase().startsWith("tr")) {
        relSegs.shift();
      }

      // Safety: bail if no image path remains after stripping transforms
      if (!relSegs.length) return url;

      // Rebuild: {basePath}/{newTransform}/{imagePath}
      u.pathname = `${basePath}/${tr}/${relSegs.join("/")}`;
      return u.toString();
    }

    // Fallback: URL passed the delivery-check but matched neither branch — return as-is
    return url;
  } catch {
    // URL parsing failed (should be rare after isImageKitDeliveryUrl) — fail gracefully
    return url;
  }
}

/**
 * Convenience wrapper around {@link imageKitOptimizedUrl} that **always**
 * enables the Northwind brand watermark overlay.
 *
 * Intended for use in share links, download buttons, or any context where the
 * exported image should carry the brand text. Accepts the same transformation
 * options as {@link imageKitOptimizedUrl}; `watermark` is always forced to
 * `true` regardless of what is passed in `opts`.
 *
 * Non-ImageKit URLs are returned unchanged (same behavior as the base function).
 *
 * @param {string | null | undefined} url
 *   The original image URL stored in the database.
 * @param {object}  [opts={}]         - ImageKit transformation options (same as
 *                                      {@link imageKitOptimizedUrl}, `watermark` is ignored).
 * @param {number}  [opts.w]          - Output width in logical pixels.
 * @param {number}  [opts.h]          - Output height in logical pixels.
 * @param {number}  [opts.q=80]       - Quality (1–100).
 * @param {string}  [opts.f="auto"]   - Output format.
 * @param {"at_max"|"maintain_ratio"} [opts.crop] - Crop / fit mode.
 * @returns {string | undefined} Watermarked ImageKit URL or the original URL.
 *
 * @example
 * const shareUrl = imageKitWatermarkedUrl(product.imageUrl, IK_PRESETS.productHero);
 * // "https://ik.imagekit.io/demo/tr:w-1200,h-1200,c-at_max,q-82,f-auto:l-text,i-Northwind,...,l-end/hero.jpg"
 */
export function imageKitWatermarkedUrl(url, opts = {}) {
  return imageKitOptimizedUrl(url, { ...opts, watermark: true });
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/**
 * Pre-configured ImageKit transformation option sets aligned to specific UI
 * layout slots.
 *
 * Dimensions are chosen at **2× logical pixels** (retina / HiDPI) where the
 * quality trade-off is worthwhile. Format is always `"auto"` so ImageKit
 * serves WebP or AVIF to browsers that support them, falling back to JPEG.
 *
 * ### Usage
 * ```js
 * import { imageKitOptimizedUrl, IK_PRESETS } from "./imagekit";
 *
 * // In a React component:
 * <img src={imageKitOptimizedUrl(product.imageUrl, IK_PRESETS.catalogCard)} />
 * ```
 *
 * @type {Record<string, { w: number; h: number; q: number; f: string }>}
 *
 * @property {object} catalogCard
 *   Catalog grid cards with a ~4:3 aspect ratio.
 *   Max rendered column width ≈ 400 px → 800 px at 2× retina.
 *
 * @property {object} productHero
 *   Full-size product detail hero image. Square bounding box accommodates
 *   both portrait and landscape product photography.
 *
 * @property {object} adminThumb
 *   Tiny preview squares in admin data-table rows (rendered at 56–72 px,
 *   144 px covers 2× retina).
 *
 * @property {object} cartThumb
 *   Line-item thumbnails in the shopping cart (`h-24 w-24` Tailwind classes
 *   → 96 px; 192 px at 2×).
 *
 * @property {object} orderLineThumb
 *   Per-line-item thumbnails in order summary views.
 *
 * @property {object} orderPreviewMd
 *   Smaller mosaic tiles in the order list (mobile / compact layout).
 *
 * @property {object} orderPreviewLg
 *   Larger mosaic tiles in the order list (desktop layout).
 *
 * @property {object} formPreview
 *   Image preview inside admin product forms (`max-h-32` container ≈ 128 px
 *   tall); wider than tall to handle landscape uploads gracefully).
 */
export const IK_PRESETS = {
  catalogCard: { w: 800, h: 600, q: 80, f: "auto" },
  productHero: { w: 1200, h: 1200, q: 82, f: "auto" },
  adminThumb: { w: 144, h: 144, q: 80, f: "auto" },
  cartThumb: { w: 192, h: 192, q: 80, f: "auto" },
  orderLineThumb: { w: 224, h: 224, q: 80, f: "auto" },
  orderPreviewMd: { w: 176, h: 176, q: 80, f: "auto" },
  orderPreviewLg: { w: 288, h: 288, q: 80, f: "auto" },
  formPreview: { w: 640, h: 320, q: 80, f: "auto" },
};
