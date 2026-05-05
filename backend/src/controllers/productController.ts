/**
 * @file productController.ts
 * @description Controller functions for handling product-related HTTP requests.
 * Provides endpoints for listing products, retrieving categories, and
 * fetching individual products by their URL slug.
 */

import { and, desc, eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

import { db } from "../db";
import { products } from "../db/schema";

/**
 * LISTS ALL ACTIVE PRODUCTS, WITH AN OPTIONAL FILTER BY CATEGORY.
 *
 * @route   GET /api/products
 * @access  Public
 *
 * @queryparam {string} [category] - Optional category name to filter products by.
 *                                   If omitted or not a string, all active
 *                                   products are returned.
 *
 * @param {Request}      req  - Express request object.
 * @param {Response}     res  - Express response object.
 * @param {NextFunction} next - Express next middleware function, used for
 *                              forwarding errors to the global error handler.
 *
 * @returns {Promise<void>} JSON response in the shape:
 * ```json
 * {
 *   "products": [
 *     {
 *       "id": "82de3d6d-d9d6-45a4-b8c1-5447493e625f",
 *       "name": "Super Widget",
 *       "category": "Gadgets",
 *       "slug": "super-widget",
 *       "description": "A widget that is super awesome and works really well.",
 *       "priceCents": 1999,
 *       "currency": "usd",
 *       "imageUrl": "https://ik.imagekit.io/example/widgets/super-widget.jpg",
 *       "imageKitFileId": "widgets/super-widget",
 *       "active": true,
 *       "createdAt": "2024-01-01T00:00:00.000Z",
 *     }
 *   ]
 * }
 * ```
 * Products are ordered by `createdAt` in descending order (newest first).
 *
 * @example
 * // Fetch all active products
 * GET /products/
 *
 * // Fetch active products in the "Gadgets" category
 * GET /products?category=Gadgets
 */
export async function listProducts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    /*
     * Safely extract the `category` query parameter.
     * Non-string values (e.g. arrays) are intentionally ignored
     * and treated as "no filter".
     */
    const cat =
      typeof req.query.category === "string" ? req.query.category.trim() : "";

    /* Base condition — always restrict results to active products only. */
    const activeOnly = eq(products.active, true);

    /*
     * Extend the base condition with a category filter when a category
     * string has been provided, otherwise fall back to `activeOnly`.
     */
    const whereClause = cat
      ? and(activeOnly, eq(products.category, cat))
      : activeOnly;

    const rows = await db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.createdAt)); // Newest products appear first.

    res.json({ products: rows });
  } catch (e) {
    /* Delegate unexpected errors to the global Express error handler. */
    next(e);
  }
}

/**
 * RETURNS AN ALPHABETICALLY SORTED LIST OF UNIQUE CATEGORIES
 * THAT HAVE AT LEAST ONE ACTIVE PRODUCT.
 *
 * @route   GET /products/categories
 * @access  Public
 *
 * @param {Request}      _req - Express request object (unused).
 * @param {Response}     res  - Express response object.
 * @param {NextFunction} next - Express next middleware function, used for
 *                              forwarding errors to the global error handler.
 *
 * @returns {Promise<void>} JSON response in the shape:
 * ```json
 * {
 *   "categories": ["Electronics", "Gadgets", "Wearables"]
 * }
 * ```
 *
 * @example
 * GET /products/categories
 */
export async function getCategories(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    /*
     * Fetch only the `category` column to minimize data transfer,
     * limiting the query to active products.
     */
    const rows = await db
      .select({ category: products.category })
      .from(products)
      .where(eq(products.active, true));

    /*
     * De-duplicate categories using a Set, then sort the resulting
     * array alphabetically using locale-aware comparison.
     */
    const categories = [...new Set(rows.map((r) => r.category))].sort((a, b) =>
      a.localeCompare(b),
    );

    res.json({ categories });
  } catch (e) {
    /* Delegate unexpected errors to the global Express error handler. */
    next(e);
  }
}

/**
 * FETCHES A SINGLE ACTIVE PRODUCT BY ITS URL-FRIENDLY SLUG.
 *
 * @route   GET /products/:slug
 * @access  Public
 *
 * @param {Request}      req       - Express request object.
 * @param {string}       req.params.slug - The unique slug identifier of the
 *                                         product (e.g. `"blue-widget"`).
 * @param {Response}     res       - Express response object.
 * @param {NextFunction} next      - Express next middleware function, used for
 *                                   forwarding errors to the global error handler.
 *
 * @returns {Promise<Response | void>}
 * - **200 OK** with the product object when found and active:
 * ```json
 * {
 *   "product": {
 *     "id": "82de3d6d-d9d6-45a4-b8c1-5447493e625f",
 *     "name": "Super Widget",
 *     "category": "Gadgets",
 *     "slug": "super-widget",
 *     "description": "A widget that is super awesome and works really well.",
 *     "priceCents": 1999,
 *     "currency": "usd",
 *     "imageUrl": "https://ik.imagekit.io/example/widgets/super-widget.jpg",
 *     "imageKitFileId": "widgets/super-widget",
 *     "active": true,
 *     "createdAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 * ```
 * - **404 Not Found** when the slug does not exist or the product is inactive:
 * ```json
 * { "error": "Not found" }
 * ```
 *
 * @example
 * GET /products/blue-widget
 */
export async function getProductBySlug(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  try {
    /*
     * Use `.limit(1)` as an optimization — once a matching row is found
     * the database can stop scanning, and array destructuring gives us
     * the first (and only expected) result directly.
     */
    const [row] = await db
      .select()
      .from(products)
      .where(eq(products.slug, req.params.slug as string))
      .limit(1);

    /*
     * Treat inactive products the same as missing ones to avoid leaking
     * information about products that exist but are not publicly available.
     */
    if (!row || !row.active) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json({ product: row });
  } catch (e) {
    /* Delegate unexpected errors to the global Express error handler. */
    next(e);
  }
}
