/**
 * @fileoverview Provides a utility function for uploading images to ImageKit.io
 * using server-side authentication tokens to keep credentials secure.
 *
 * @module imagekit-upload
 * @requires ./api.js
 */

import { apiFetch } from "./api.js";

/**
 * The ImageKit.io REST API endpoint used for file uploads.
 *
 * @constant {string}
 * @see {@link https://docs.imagekit.io/api-reference/upload-file-api/client-side-file-upload}
 */
const UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";

/**
 * Uploads an image file to ImageKit.io using short-lived auth credentials
 * fetched from the application's own backend, so the ImageKit private key
 * is never exposed to the browser.
 *
 * @async
 * @function uploadImageToImageKit
 *
 * @param {File}     file              - The browser {@link File} object to upload.
 * @param {Function} getToken          - Async callback that resolves to a valid
 *                                       bearer token for the internal API; passed
 *                                       directly to {@link apiFetch}.
 * @param {Object}   [opts={}]         - Optional configuration overrides.
 * @param {string}   [opts.folder="products"]
 *                                     - Destination folder path inside the
 *                                       ImageKit media library.
 * @param {string}   [opts.fileName]   - Override for the remote file name.
 *                                       When omitted the original file name is
 *                                       sanitized and truncated automatically
 *                                       (see sanitization rules below).
 *
 * @returns {Promise<{ url: string, fileId: string|null }>}
 *   Resolves with an object containing:
 *   - `url`    – The publicly accessible CDN URL of the uploaded file.
 *   - `fileId` – The ImageKit file ID (useful for later deletions / updates),
 *                or `null` when the API response omits it.
 *
 * @throws {Error} `"ImageKit upload failed"` – when the ImageKit API responds
 *   with a non-2xx HTTP status code, or when the success response body does
 *   not contain a `url` field.
 *
 * @example
 * // Inside a React component or form submit handler:
 * const fileInput = document.querySelector('input[type="file"]');
 * const file = fileInput.files[0];
 *
 * const { url, fileId } = await uploadImageToImageKit(
 *   file,
 *   getAccessToken,       // e.g. from an auth SDK such as Clerk / Auth0
 *   { folder: "avatars", fileName: "profile-pic.jpg" }
 * );
 *
 * console.log("Uploaded to:", url);
 */
export async function uploadImageToImageKit(file, getToken, opts = {}) {
  const { folder = "products", fileName } = opts;

  /*
   * Fetch short-lived signing credentials from the application's own backend.
   * The backend (not the browser) holds the ImageKit private key and uses it
   * to generate a signature, token, and expiry timestamp.
   */
  const auth = await apiFetch("/api/admin/imagekit/auth", { getToken });

  /*
   * Sanitize the file name so it is safe for use in a URL / remote filesystem:
   *   - Replace every character that is NOT a word character (\w), dot, or
   *     hyphen with an underscore.
   *     e.g. "my photo @ home.png" → "my_photo___home.png"
   *   - Truncate to 200 characters to stay within common filename length limits.
   *   - Fall back to a timestamped default if the sanitized result is empty
   *     (e.g. the original name consisted entirely of special characters).
   *
   * The caller-supplied `fileName` (opts.fileName) always takes precedence and
   * bypasses this sanitization step entirely.
   */
  const safeName =
    fileName ??
    (file.name.replace(/[^\w.-]/g, "_").slice(0, 200) ||
      `upload-${Date.now()}.jpg`);

  /*
   * Build the multipart form body required by the ImageKit client-side upload
   * API. All authentication fields come from the server-issued auth object.
   */
  const form = new FormData();
  form.append("file", file);
  form.append("fileName", safeName);
  form.append("publicKey", auth.publicKey);
  form.append("signature", auth.signature);
  form.append("token", auth.token);
  form.append("expire", String(auth.expire)); // must be a string in the form
  form.append("folder", folder);

  // POST directly to ImageKit — the browser never exposes private credentials.
  const res = await fetch(UPLOAD_URL, { method: "POST", body: form });
  const data = await res.json();

  /*
   * Handle HTTP-level errors (4xx / 5xx).
   * Log the status and raw response body to aid debugging before throwing.
   */
  if (!res.ok) {
    console.log("[ImageKit upload]", res.status, data);
    throw new Error("ImageKit upload failed");
  }

  /*
   * Guard against a technically successful (2xx) response that is still
   * missing the `url` field — which would cause silent failures downstream.
   */
  if (!data.url) {
    console.log("[ImageKit upload] missing url in response", data);
    throw new Error("ImageKit upload failed");
  }

  return {
    /** @type {string} Publicly accessible CDN URL of the uploaded image. */
    url: data.url,
    /** @type {string|null} ImageKit file ID, or null if not returned. */
    fileId: data.fileId ?? null,
  };
}
