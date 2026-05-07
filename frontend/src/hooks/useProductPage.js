/**
 * @fileoverview Custom hook for fetching and managing product page data.
 * @module useProductPage
 */

import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api.js";

/**
 * @typedef {Object} Product
 * @property {string} id        - The unique identifier of the product.
 * @property {string} slug      - The URL-friendly unique identifier of the product (e.g. `"blue-mug"`).
 * @property {string} name      - The display name of the product.
 * @property {string} description - An long-form product description.
 * @property {string} category - An grouping label.
 * @property {number} priceCents     - The listed price in smallest currency unit.
 * @property {string} imageUrl - An URL of the product image.
 * @property {string} imageKitFileId - An ImageKit `fileId`.
 * @property {string} currency - An ISO 4217 currency code.
 * @property {boolean} active - An boolean indicating whether the product is visible/purchasable.
 * @property {string} createdAt - An timestamp of when the product was created.
 */

/**
 * @typedef {Object} ProductPageResult
 * @property {string | undefined} slug    - The slug extracted from the current route parameters.
 * @property {Product | null}    product  - The fetched product data, or `null` if not yet available.
 * @property {boolean}           isLoading - Whether the product data is currently being fetched.
 * @property {Error | null}      error     - The error object if the query failed, otherwise `null`.
 */

/**
 * Custom hook that retrieves product data based on the `slug` route parameter.
 *
 * This hook combines `useParams` from React Router to extract the product slug
 * from the current URL and `useQuery` from TanStack Query to fetch the
 * corresponding product data from the API.
 *
 * The query is only executed when a valid `slug` is present in the URL,
 * preventing unnecessary API calls on routes where the slug is undefined.
 *
 * @returns {ProductPageResult} An object containing the slug, product data,
 *                              loading state, and any query error.
 *
 * @example
 * // Usage inside a product page component
 * function ProductPage() {
 *   const { slug, product, isLoading, error } = useProductPage();
 *
 *   if (isLoading) return <p>Loading...</p>;
 *   if (error)     return <p>Error: {error.message}</p>;
 *   if (!product)  return <p>No product found for "{slug}".</p>;
 *
 *   return (
 *     <div>
 *       <h1>{product.name}</h1>
 *       <p>{product.description}</p>
 *       <span>${product.price}</span>
 *     </div>
 *   );
 * }
 */
export function useProductPage() {
  // Extract the `slug` parameter from the current route, e.g. /products/:slug
  const { slug } = useParams();

  const { data, isLoading, error } = useQuery({
    /**
     * Unique cache key for this query, scoped to the specific product slug.
     * TanStack Query uses this to cache and deduplicate requests.
     */
    queryKey: ["product", slug],

    /**
     * Fetches the product data from the REST API using the current slug.
     * The `apiFetch` utility wraps the native fetch API with common configuration.
     */
    queryFn: () => apiFetch(`/api/products/${slug}`),

    /**
     * Prevents the query from running if `slug` is falsy (e.g. undefined or
     * an empty string), avoiding malformed API requests.
     */
    enabled: Boolean(slug),
  });

  return {
    /** The slug extracted from the URL route parameters. */
    slug,

    /** The product object from the API response, or null if unavailable. */
    product: data?.product ?? null,

    /** True while the API request is in-flight. */
    isLoading,

    /** Contains the error details if the request failed, otherwise null. */
    error,
  };
}
