/**
 * @fileoverview Locale-aware formatting utilities for prices and order dates.
 *
 * All functions delegate to the built-in `Intl` APIs so that the output
 * automatically matches the end-user's locale (language, region, number
 * separators, currency symbol position, 12 h / 24 h clock, etc.) without
 * any manual locale configuration in the call-site code.
 *
 * ## Key design decisions
 * - **`undefined` locale** — passing `undefined` to `Intl` constructors
 *   instructs the runtime to use the browser's (or Node's) default locale,
 *   which is the correct behavior for a storefront UI.
 * - **Cents-based prices** — monetary values are stored and passed around as
 *   integer cents (e.g. `1999` = $19.99) to avoid floating-point rounding
 *   errors. `formatPrice` performs the ÷ 100 conversion internally.
 * - **Graceful degradation** — date helpers return an empty string rather
 *   than throwing when the input is missing or un-parseable, so they are safe
 *   to call directly in JSX / templates without extra null-checks.
 *
 * @module formatting
 */

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

/**
 * Formats a **cent-denominated integer** as a localized currency string.
 *
 * The conversion from cents to the major currency unit (÷ 100) and all
 * locale-specific details — symbol, grouping separators, decimal separator,
 * symbol placement — are handled automatically by `Intl.NumberFormat` using
 * the runtime's default locale.
 *
 * @param {number} cents
 *   The price expressed in the smallest currency unit (cents for USD/EUR, etc.).
 *   For example, pass `1999` to represent $19.99.
 * @param {string | null | undefined} [currency]
 *   An ISO 4217 currency code (e.g. `"usd"`, `"EUR"`, `"gbp"`).
 *   Case-insensitive — the value is upper-cased internally before being passed
 *   to `Intl.NumberFormat`. Defaults to `"USD"` when `null` or `undefined`.
 * @returns {string}
 *   A localized, human-readable currency string, e.g. `"$19.99"` (en-US) or
 *   `"19,99 €"` (de-DE).
 *
 * @example <caption>Basic USD price (default currency)</caption>
 * formatPrice(1999);
 * // => "$19.99"  (en-US locale)
 *
 * @example <caption>Explicit EUR currency</caption>
 * formatPrice(4999, "eur");
 * // => "€49.99"  (en-US locale) | "49,99 €"  (de-DE locale)
 *
 * @example <caption>Null-safe currency fallback</caption>
 * formatPrice(500, null);
 * // => "$5.00"   (falls back to "USD")
 *
 * @example <caption>Usage in JSX</caption>
 * <span>{formatPrice(product.priceCents, product.currency)}</span>
 */
export function formatPrice(cents, currency) {
  return new Intl.NumberFormat(
    undefined, // use the runtime's default locale automatically
    {
      style: "currency",
      // Normalize to uppercase (ISO 4217 requires uppercase codes).
      // Fall back to "USD" when currency is null / undefined.
      currency: (currency ?? "usd").toUpperCase(),
    },
  ).format(
    cents / 100, // convert from smallest unit (cents) to major unit (dollars)
  );
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * Formats an **ISO 8601 date-time string** as a localized, human-readable
 * order timestamp that includes both a date portion and a short time portion.
 *
 * The function is intentionally lenient with its input:
 * - An empty / falsy value returns `""` instead of throwing.
 * - An un-parseable string returns `""` instead of `"Invalid Date"`.
 *
 * This makes it safe to pass raw API response values directly without
 * defensive wrapping at the call-site.
 *
 * ### Output examples (vary by locale)
 * | Locale  | `dateStyle`   | Example output               |
 * |---------|---------------|------------------------------|
 * | en-US   | `"medium"`    | `"Jan 15, 2025, 3:45 PM"`    |
 * | en-US   | `"long"`      | `"January 15, 2025, 3:45 PM"`|
 * | en-US   | `"short"`     | `"1/15/25, 3:45 PM"`         |
 * | de-DE   | `"medium"`    | `"15. Jan. 2025, 15:45"`     |
 *
 * @param {string | null | undefined} iso
 *   An ISO 8601 date-time string as typically returned by a REST or GraphQL
 *   API (e.g. `"2025-01-15T15:45:00.000Z"`). Falsy values (`""`, `null`,
 *   `undefined`) are handled gracefully.
 * @param {object}  [opts={}]                                        - Formatting options.
 * @param {"full"|"long"|"medium"|"short"} [opts.dateStyle="medium"] - Controls the verbosity of
 *   the date portion. Maps directly to the `Intl.DateTimeFormat` `dateStyle`
 *   option. The time portion is always rendered at `"short"` verbosity.
 * @returns {string}
 *   A localized date-time string (e.g. `"Jan 15, 2025, 3:45 PM"` in en-US),
 *   or `""` if `iso` is falsy or cannot be parsed as a valid date.
 *
 * @example <caption>Default medium date style</caption>
 * formatOrderWhen("2025-01-15T15:45:00.000Z");
 * // => "Jan 15, 2025, 3:45 PM"  (en-US)
 *
 * @example <caption>Long date style for order confirmation pages</caption>
 * formatOrderWhen("2025-01-15T15:45:00.000Z", { dateStyle: "long" });
 * // => "January 15, 2025, 3:45 PM"  (en-US)
 *
 * @example <caption>Short date style for compact order-history tables</caption>
 * formatOrderWhen("2025-01-15T15:45:00.000Z", { dateStyle: "short" });
 * // => "1/15/25, 3:45 PM"  (en-US)
 *
 * @example <caption>Graceful handling of missing / invalid values</caption>
 * formatOrderWhen(null);             // => ""
 * formatOrderWhen("");               // => ""
 * formatOrderWhen("not-a-date");     // => ""
 *
 * @example <caption>Usage in JSX</caption>
 * <time dateTime={order.placedAt}>
 *   {formatOrderWhen(order.placedAt)}
 * </time>
 */
export function formatOrderWhen(iso, opts = {}) {
  // Allow callers to override the date verbosity; default to "medium" which
  // strikes the best balance between brevity and readability in order UIs.
  const { dateStyle = "medium" } = opts;

  // Gracefully handle null / undefined / empty string from API responses
  if (!iso) return "";

  const date = new Date(iso);

  // new Date("not-a-date") produces an invalid Date object whose getTime()
  // returns NaN. Return "" rather than letting Intl.DateTimeFormat render
  // the string "Invalid Date".
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(
    undefined, // use the runtime's default locale automatically
    {
      dateStyle, // caller-controlled date verbosity ("short" | "medium" | "long" | "full")
      timeStyle: "short", // always show hours and minutes; seconds are noisy in order UIs
    },
  ).format(date);
}
