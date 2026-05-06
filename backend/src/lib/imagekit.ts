/**
 * @fileoverview ImageKit asset management utilities.
 *
 * Provides helper functions for interacting with the ImageKit Media Library
 * API. Currently exposes a single deletion helper that is safe to call even
 * when no file ID is stored (e.g. for products that were created without an
 * image).
 *
 * @module lib/imagekit
 */

import ImageKit, { NotFoundError } from "@imagekit/nodejs";

import type { Env } from "./env.js";

/**
 * Deletes a file from the ImageKit Media Library by its file ID.
 *
 * @remarks
 * This function is designed to be **safe by default**:
 *
 * - **No-op on missing ID** — If `storedFileId` is `null`, `undefined`, or
 *   an empty string, the function returns immediately without making any
 *   network request. This covers the common case where a product was saved
 *   without an associated image.
 *
 * - **Idempotent on 404** — If ImageKit responds with a {@link NotFoundError}
 *   (i.e. the file has already been deleted or never existed), the error is
 *   silently swallowed. This prevents spurious failures during retries or
 *   after manual asset removal directly in the ImageKit dashboard.
 *
 * - **Propagates all other errors** — Any unexpected error (network failure,
 *   invalid credentials, rate-limiting, etc.) is re-thrown so that callers
 *   can handle or log it appropriately.
 *
 * @param env          - Resolved application environment variables. The
 *                       `IMAGEKIT_PRIVATE_KEY` field is used to authenticate
 *                       the ImageKit SDK client.
 * @param storedFileId - The ImageKit file ID previously returned by the
 *                       upload API and persisted in the database, or `null`
 *                       if no image was ever associated with the record.
 * @returns A `Promise` that resolves to `void` once the file has been deleted
 *          (or when deletion is safely skipped).
 * @throws {Error} Re-throws any ImageKit API error that is **not** a
 *                 {@link NotFoundError}, preserving the original error for
 *                 upstream handling.
 *
 * @example
 * // Product has an associated image — asset is deleted from ImageKit.
 * await deleteImageKitAsset(env, "file_abc123");
 *
 * @example
 * // Product was created without an image — function exits immediately.
 * await deleteImageKitAsset(env, null);
 *
 * @example
 * // Typical usage inside a product deletion handler:
 * await deleteImageKitAsset(env, existing.imageKitFileId);
 * await db.delete(products).where(eq(products.id, id));
 */
export async function deleteImageKitAsset(
  env: Env,
  storedFileId: string | null,
): Promise<void> {
  // Guard: nothing to delete when no file ID is recorded.
  if (!storedFileId) return;

  const client = new ImageKit({ privateKey: env.IMAGEKIT_PRIVATE_KEY });

  try {
    await client.files.delete(storedFileId);
  } catch (e: unknown) {
    // The asset may have already been removed (e.g. deleted manually via the
    // ImageKit dashboard or by a previous request). Treat this as a success
    // to keep deletion idempotent.
    if (e instanceof NotFoundError) return;

    // Any other error (auth failure, network timeout, etc.) is unexpected
    // and should surface to the caller for proper handling / logging.
    throw e;
  }
}
