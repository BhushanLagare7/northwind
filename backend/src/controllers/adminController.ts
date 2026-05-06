/**
 * @fileoverview Admin product management controller.
 *
 * Provides Express route handlers for admin-only product CRUD operations,
 * ImageKit authentication, and role-based access control middleware.
 *
 * All mutating endpoints require the request to pass through the
 * {@link requireAdmin} middleware, which verifies both authentication
 * (via Clerk) and admin-level authorization.
 *
 * @module controllers/adminController
 */

import { getAuth } from "@clerk/express";
import ImageKit from "@imagekit/nodejs";
import { count, desc, eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { db } from "../db";
import { orderItems, products } from "../db/schema";
import { getEnv } from "../lib/env";
import { deleteImageKitAsset } from "../lib/imagekit";
import { isAdmin } from "../lib/roles";
import { getLocalUser } from "../lib/users";

/** Resolved environment variables used across this module. */
const env = getEnv();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

/**
 * Zod schema for validating the request body when creating a new product.
 *
 * @remarks
 * - `slug`            – URL-friendly unique identifier (required, non-empty).
 * - `name`            – Human-readable product name (required, non-empty).
 * - `category`        – Product category; defaults to `"General"`.
 * - `description`     – Long-form product description; defaults to `""`.
 * - `priceCents`      – Price expressed in the smallest currency unit,
 *                       e.g. cents for USD (required, positive integer).
 * - `currency`        – ISO 4217 currency code; defaults to `"usd"`.
 * - `imageUrl`        – Publicly accessible image URL, empty string, or null.
 * - `imageKitFileId`  – ImageKit file identifier used for asset deletion;
 *                       accepts a non-empty string, empty string, or null.
 * - `active`          – Whether the product is publicly visible; defaults to `true`.
 */
const productCreate = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1).default("General"),
  description: z.string().default(""),
  priceCents: z.number().int().positive(),
  currency: z.string().min(1).default("usd"),
  imageUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable(),
  imageKitFileId: z
    .union([z.string().min(1), z.literal(""), z.null()])
    .optional(),
  active: z.boolean().default(true),
});

/**
 * Zod schema for validating the request body when partially updating a product.
 *
 * Every field from {@link productCreate} is made optional, so callers may
 * send only the fields they wish to change (HTTP PATCH semantics).
 */
const productPatch = productCreate.partial();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a validated partial product body into a Drizzle-compatible update
 * object containing only the fields that were explicitly provided.
 *
 * @remarks
 * Fields absent from `body` (i.e. `undefined`) are intentionally omitted so
 * that a PATCH request cannot accidentally overwrite existing database values
 * with `undefined`. Additionally:
 * - An empty `imageUrl` string is normalized to `null`.
 * - An empty `imageKitFileId` string is normalized to `null`.
 *
 * @param body - A validated partial product payload produced by
 *               {@link productPatch}.safeParse().
 * @returns A plain object ready to be passed to `db.update(products).set()`.
 *
 * @example
 * ```ts
 * const data = buildProductUpdateSet({ name: "New Name", active: false });
 * // => { name: "New Name", active: false }
 * ```
 */
function buildProductUpdateSet(body: z.infer<typeof productPatch>) {
  const data: Partial<typeof products.$inferInsert> = {};

  if (body.slug !== undefined) data.slug = body.slug;
  if (body.name !== undefined) data.name = body.name;
  if (body.category !== undefined) data.category = body.category;
  if (body.description !== undefined) data.description = body.description;
  if (body.priceCents !== undefined) data.priceCents = body.priceCents;
  if (body.currency !== undefined) data.currency = body.currency;

  // Normalize empty strings to null so the DB column stores a proper NULL.
  if (body.imageUrl !== undefined) {
    data.imageUrl = body.imageUrl === "" ? null : body.imageUrl;
  }
  if (body.imageKitFileId !== undefined) {
    data.imageKitFileId =
      body.imageKitFileId === "" ? null : body.imageKitFileId;
  }

  if (body.active !== undefined) data.active = body.active;

  return data;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that restricts a route to authenticated admin users.
 *
 * Execution flow:
 * 1. Extracts the Clerk session from the request via `getAuth`.
 * 2. Returns **401 Unauthorized** if the user is not authenticated.
 * 3. Fetches the corresponding local user record from the database.
 * 4. Returns **403 Forbidden** if the user does not hold the admin role.
 * 5. Calls `next()` to proceed to the actual route handler.
 *
 * @param req  - Incoming Express request (must carry a valid Clerk session
 *               cookie / bearer token).
 * @param res  - Express response used to send 401/403 error payloads.
 * @param next - Calls the next middleware or route handler on success, or
 *               forwards unexpected errors to the global error handler.
 *
 * @example
 * ```ts
 * router.use("/admin", requireAdmin);
 * ```
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { userId, isAuthenticated } = getAuth(req);

    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await getLocalUser(userId);

    if (!isAdmin(user.role)) {
      res.status(403).json({ error: "Admin only" });
      return;
    }

    next();
  } catch (e) {
    next(e);
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * Returns signed ImageKit authentication parameters together with the
 * public key and URL endpoint required by the ImageKit client SDK.
 *
 * @remarks
 * This endpoint is typically consumed by the frontend before uploading an
 * image directly to ImageKit. The private key never leaves the server.
 *
 * **Response body**
 * ```json
 * {
 *   "token":       "<signed-token>",
 *   "expire":      1234567890,
 *   "signature":   "<hmac-signature>",
 *   "publicKey":   "public_...",
 *   "urlEndpoint": "https://ik.imagekit.io/your-id"
 * }
 * ```
 *
 * @param _req - Express request (unused; underscore prefix is intentional).
 * @param res  - Express response carrying the auth payload.
 * @param next - Forwards unexpected errors to the global error handler.
 */
export function getImageKitAuth(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const client = new ImageKit({ privateKey: env.IMAGEKIT_PRIVATE_KEY });
    const auth = client.helper.getAuthenticationParameters();

    res.json({
      ...auth,
      publicKey: env.IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Lists all products in the database, ordered from newest to oldest.
 *
 * **Response body**
 * ```json
 * { "products": [ { ...product }, ... ] }
 * ```
 *
 * @param _req - Express request (unused).
 * @param res  - Express response carrying the product list.
 * @param next - Forwards unexpected errors to the global error handler.
 */
export async function listAdminProducts(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const rows = await db
      .select()
      .from(products)
      .orderBy(desc(products.createdAt));

    res.json({ products: rows });
  } catch (e) {
    next(e);
  }
}

/**
 * Creates a new product from the validated request body.
 *
 * **Request body** — see {@link productCreate} for the full field reference.
 *
 * **Success** – `201 Created` with the inserted product row.
 * ```json
 * { "product": { "id": "...", "slug": "...", ... } }
 * ```
 *
 * **Failure** – `400 Bad Request` when the body fails Zod validation.
 * ```json
 * { "error": "Invalid body", "details": { ... } }
 * ```
 *
 * @param req  - Express request; `req.body` must conform to {@link productCreate}.
 * @param res  - Express response.
 * @param next - Forwards unexpected errors to the global error handler.
 */
export async function createAdminProduct(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = productCreate.safeParse(req.body);

    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }

    // Destructure image fields separately so empty strings can be
    // normalized to null before persisting.
    const { imageUrl, imageKitFileId, ...rest } = parsed.data;

    const [row] = await db
      .insert(products)
      .values({
        ...rest,
        imageUrl: imageUrl || null,
        imageKitFileId: imageKitFileId || null,
      })
      .returning();

    res.status(201).json({ product: row });
  } catch (e) {
    next(e);
  }
}

/**
 * Partially updates an existing product identified by `req.params.id`.
 *
 * Only fields included in the request body are written to the database;
 * omitted fields retain their current values (PATCH semantics).
 *
 * **Request body** — any subset of the fields defined in {@link productCreate}.
 *
 * **Success** – `200 OK` with the updated product row.
 * ```json
 * { "product": { "id": "...", "slug": "...", ... } }
 * ```
 *
 * **Failure**
 * - `400 Bad Request` — body is invalid or contains no updatable fields.
 * - `404 Not Found`   — no product with the given `id` exists.
 *
 * @param req  - Express request; `req.params.id` identifies the product and
 *               `req.body` carries the fields to update.
 * @param res  - Express response.
 * @param next - Forwards unexpected errors to the global error handler.
 */
export async function updateAdminProduct(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = productPatch.safeParse(req.body);

    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }

    const data = buildProductUpdateSet(parsed.data);

    // Guard against an empty PATCH that would produce an invalid SQL statement.
    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const [row] = await db
      .update(products)
      .set(data)
      .where(eq(products.id, req.params.id as string))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json({ product: row });
  } catch (e) {
    next(e);
  }
}

/**
 * Permanently deletes a product and its associated ImageKit asset.
 *
 * @remarks
 * Deletion is blocked if the product is referenced by one or more order line
 * items, because removing it would violate referential integrity and break
 * historical order records. Callers should deactivate the product instead
 * (set `active: false` via {@link updateAdminProduct}).
 *
 * Execution flow:
 * 1. Verify the product exists → **404** if not found.
 * 2. Count related `orderItems` rows → **409 Conflict** if count > 0.
 * 3. Delete the ImageKit asset (best-effort; errors are propagated).
 * 4. Delete the product row from the database.
 * 5. Return `{ ok: true }` on success.
 *
 * **Success** – `200 OK`
 * ```json
 * { "ok": true }
 * ```
 *
 * **Failure**
 * - `404 Not Found`  — product does not exist.
 * - `409 Conflict`   — product is attached to one or more orders.
 *
 * @param req  - Express request; `req.params.id` is the product UUID.
 * @param res  - Express response.
 * @param next - Forwards unexpected errors to the global error handler.
 */
export async function deleteAdminProduct(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id as string;

    // Step 1 – Confirm the product exists before doing anything else.
    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Step 2 – Prevent deletion of products that belong to existing orders.
    const [countRow] = await db
      .select({ c: count() })
      .from(orderItems)
      .where(eq(orderItems.productId, id));

    if (Number(countRow?.c ?? 0) > 0) {
      res.status(409).json({
        error:
          "This product is on one or more orders and cannot be deleted. " +
          "Deactivate it instead.",
      });
      return;
    }

    // Step 3 – Remove the image from ImageKit (no-op if fileId is null).
    await deleteImageKitAsset(env, existing.imageKitFileId);

    // Step 4 – Remove the database record.
    await db.delete(products).where(eq(products.id, id));

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
