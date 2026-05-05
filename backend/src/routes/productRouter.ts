/**
 * @file productRouter.ts
 * @description Defines and exports the Express router for all product-related
 * API endpoints. Each route is mapped to its corresponding controller function
 * which contains the business logic and database interaction.
 *
 * @module productRouter
 *
 * @baseRoute /api/products
 * All routes defined in this file are mounted under the `/api/products` base path
 * by the main application entry point (e.g. `app.use("/api/products", productRouter)`).
 *
 * Route Overview:
 * ┌─────────────────────────────┬────────────────────────────────────────────┐
 * │ Endpoint                    │ Description                                │
 * ├─────────────────────────────┼────────────────────────────────────────────┤
 * │ GET /api/products           │ List all active products (filterable)      │
 * │ GET /api/products/categories│ List all unique active product categories  │
 * │ GET /api/products/:slug     │ Fetch a single product by its slug         │
 * └─────────────────────────────┴────────────────────────────────────────────┘
 */

import { Router } from "express";

import {
  getCategories,
  getProductBySlug,
  listProducts,
} from "../controllers/productController";

/**
 * Express router instance scoped to product-related routes.
 * This router is intended to be mounted under the `/api/products` path
 * in the main application file.
 *
 * @type {Router}
 *
 * @example
 * // In your main app file (e.g. app.ts / index.ts):
 * import productRouter from "./routes/productRouter";
 * app.use("/api/products", productRouter);
 */
const router = Router();

/**
 * @route   GET /products
 * @description Retrieves a list of all active products from the database,
 * ordered by creation date (newest first). Supports an optional `category`
 * query parameter to narrow results down to a specific product category.
 *
 * @queryparam {string} [category] - Filters the returned products to only
 *                                   those belonging to the specified category.
 *                                   Omitting this parameter returns all active
 *                                   products regardless of category.
 *
 * @handler {@link listProducts}
 *
 * @returns {200} JSON array of active product objects.
 * @returns {500} Internal server error if the database query fails.
 *
 * @example
 * // Retrieve all active products
 * GET /products
 *
 * // Retrieve active products in the "Gadgets" category
 * GET /products?category=Gadgets
 */
router.get("/", listProducts);

/**
 * @route   GET /products/categories
 * @description Retrieves an alphabetically sorted list of unique category
 * names that have at least one active product associated with them.
 *
 * @note This route is intentionally defined before `GET /products/:slug`
 * to prevent Express from mistakenly interpreting the literal string
 * "categories" as a dynamic `:slug` parameter.
 *
 * @handler {@link getCategories}
 *
 * @returns {200} JSON array of unique, sorted category name strings.
 * @returns {500} Internal server error if the database query fails.
 *
 * @example
 * GET /products/categories
 *
 * // Example response:
 * // { "categories": ["Electronics", "Gadgets", "Wearables"] }
 */
router.get("/categories", getCategories);

/**
 * @route   GET /products/:slug
 * @description Retrieves a single active product whose `slug` field matches
 * the value provided in the URL path parameter. Inactive products are treated
 * the same as non-existent ones and result in a 404 response, preventing
 * information leakage about unlisted products.
 *
 * @urlparam {string} slug - The unique, URL-friendly identifier for the product
 *                           (e.g. `"blue-widget"`). Must match the `slug` field
 *                           stored in the database exactly.
 *
 * @handler {@link getProductBySlug}
 *
 * @returns {200} JSON object containing the matched product.
 * @returns {404} Product does not exist or is inactive.
 * @returns {500} Internal server error if the database query fails.
 *
 * @example
 * GET /products/blue-widget
 *
 * // Example response:
 * // { "product": { "id": 1, "name": "Blue Widget", "slug": "blue-widget", ... } }
 */
router.get("/:slug", getProductBySlug);

export default router;
