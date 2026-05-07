/**
 * @fileoverview Custom hook for managing the home page product catalog.
 *
 * Handles category filtering via URL search parameters and fetches
 * both product categories and products from the API, supporting
 * filtered queries based on the selected category.
 */

import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api.js";

/**
 * Custom hook that manages the home page catalog state, including:
 * - Reading and updating the active category filter from the URL
 * - Fetching the list of available product categories
 * - Fetching products, optionally filtered by the active category
 *
 * The category filter is persisted in the URL as a `category` query
 * parameter (e.g. `/?category=electronics`), allowing users to share
 * or bookmark filtered views.
 *
 * @returns {Object} Catalog state and controls
 *
 * @returns {string}   returns.categoryFilter
 *   The currently active category filter trimmed from the URL search
 *   params. Defaults to an empty string when no filter is applied.
 *
 * @returns {Function} returns.setCategory
 *   Callback to update the active category filter.
 *   - Passing a non-empty string sets `?category=<value>` in the URL.
 *   - Passing an empty string / falsy value removes the parameter.
 *   The URL is updated via `replace` so the change does not create a
 *   new browser history entry.
 *   @param {string} category - The category value to apply (or "" to clear).
 *
 * @returns {string[]} returns.categories
 *   Array of available product category strings fetched from the API.
 *   Defaults to an empty array while loading or on error.
 *
 * @returns {Object[]} returns.products
 *   Array of product objects fetched from the API, filtered by
 *   `categoryFilter` when one is active.
 *   Defaults to an empty array while loading or on error.
 *
 * @returns {boolean} returns.categoryChipsLoading
 *   `true` only during the very first categories fetch (i.e. the
 *   request is in-flight AND no cached categories exist yet).
 *   Use this flag to show skeleton chips in the UI without causing
 *   a re-flash on subsequent navigation's.
 *
 * @returns {boolean} returns.loadingCategories
 *   `true` whenever the categories query is in a loading state,
 *   regardless of whether cached data is already available.
 *
 * @returns {boolean} returns.loadingList
 *   `true` whenever the products query is in a loading state.
 *
 * @returns {Error|null} returns.error
 *   The error object if the products query failed, otherwise `null`.
 *
 * @example
 * function HomeCatalog() {
 *   const {
 *     categoryFilter,
 *     setCategory,
 *     categories,
 *     products,
 *     categoryChipsLoading,
 *     loadingList,
 *     error,
 *   } = useHomeCatalog();
 *
 *   if (error) return <p>Failed to load products.</p>;
 *
 *   return (
 *     <>
 *       <CategoryChips
 *         categories={categories}
 *         active={categoryFilter}
 *         loading={categoryChipsLoading}
 *         onSelect={setCategory}
 *       />
 *       <ProductGrid products={products} loading={loadingList} />
 *     </>
 *   );
 * }
 */
export function useHomeCatalog() {
  // -------------------------------------------------------------------------
  // URL-based category filter
  // -------------------------------------------------------------------------

  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * The current category value read from `?category=` in the URL.
   * Trimmed to avoid accidental whitespace mismatches.
   * Falls back to an empty string when the parameter is absent.
   */
  const categoryFilter = searchParams.get("category")?.trim() ?? "";

  /**
   * Updates the `?category=` URL search parameter.
   *
   * Uses `replace: true` to avoid polluting the browser history stack
   * when the user clicks between filter chips.
   *
   * @param {string} category - Category to apply, or falsy to clear the filter.
   */
  const setCategory = (category) => {
    // Clone current params so we don't mutate the original object.
    const next = new URLSearchParams(searchParams);

    if (!category) next.delete("category");
    else next.set("category", category);

    setSearchParams(next, { replace: true });
  };

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  /**
   * Fetches all available product categories.
   *
   * Query key: `["product-categories"]`
   * The key is static because the category list is not parameterized.
   */
  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ["product-categories"],
    queryFn: () => apiFetch("/api/products/categories"),
  });

  /**
   * Fetches products, scoped to `categoryFilter` when one is active.
   *
   * Query key: `["products", categoryFilter]`
   * Including `categoryFilter` in the key ensures React Query treats
   * each category as a separate cache entry and refetches automatically
   * whenever the filter changes.
   */
  const {
    data: productsData,
    isLoading: loadingList,
    error,
  } = useQuery({
    queryKey: ["products", categoryFilter],
    queryFn: () =>
      apiFetch(
        categoryFilter
          ? `/api/products?category=${encodeURIComponent(categoryFilter)}`
          : "/api/products",
      ),
  });

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  /** Safely unwrap categories array from the API response. */
  const categories = categoriesData?.categories ?? [];

  /** Safely unwrap products array from the API response. */
  const products = productsData?.products ?? [];

  /**
   * Indicates a "cold" loading state for the category chips.
   *
   * Remains `false` once at least one successful fetch has populated
   * the cache, preventing unnecessary skeleton flashes on re-renders.
   */
  const categoryChipsLoading = loadingCategories && categories.length === 0;

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  return {
    categoryFilter, // Currently active category string (or "")
    setCategory, // Setter that syncs the filter to the URL
    categories, // Available category options for filter chips
    products, // Products matching the current filter
    categoryChipsLoading, // True only on the very first categories load
    loadingCategories, // True whenever categories are being fetched
    loadingList, // True whenever products are being fetched
    error, // Products fetch error (null when successful)
  };
}
