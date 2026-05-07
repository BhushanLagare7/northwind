/**
 * @fileoverview Authenticated API fetch utility with Sentry error tracking.
 *
 * Provides a thin wrapper around the native `fetch` API that:
 *  - Resolves the correct base URL from the VITE_API_URL environment variable.
 *  - Attaches a Bearer token to every request when an auth getter is supplied.
 *  - Logs breadcrumbs to Sentry for every request (successful or not).
 *  - Captures exceptions in Sentry for network failures and 5xx responses.
 */

import * as Sentry from "@sentry/react";

/**
 * Base URL for all API requests, derived from the `VITE_API_URL` environment
 * variable. Trailing slashes are stripped so that path segments can be
 * concatenated with a leading slash without producing double-slash URLs
 * (e.g. "https://api.example.com" + "/users" → "https://api.example.com/users").
 *
 * Falls back to an empty string when the variable is absent, which causes
 * requests to be made relative to the current origin — useful for local
 * development when the API is served from the same host.
 *
 * @type {string}
 */
const raw = import.meta.env.VITE_API_URL;
const base = typeof raw === "string" ? raw.replace(/\/+$/, "") : "";

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * Options accepted by {@link apiFetch}.
 *
 * @typedef  {Object}                    ApiFetchOptions
 * @property {() => Promise<string|null|undefined>} [getToken]
 *   Async function that resolves to a JWT (or similar Bearer token).
 *   When provided, the resolved value is attached as an `Authorization`
 *   header.  If the function resolves to a falsy value no header is added.
 * @property {"GET"|"POST"|"PUT"|"PATCH"|"DELETE"|"HEAD"} [method="GET"]
 *   HTTP method to use for the request.
 * @property {unknown} [body]
 *   Request payload.  Will be serialized with `JSON.stringify` and sent with
 *   a `Content-Type: application/json` header.  Omit (or pass `undefined`)
 *   for requests that carry no body (e.g. GET, DELETE).
 */

// ---------------------------------------------------------------------------
// Main utility
// ---------------------------------------------------------------------------

/**
 * Sends an authenticated HTTP request to the project's backend API and returns
 * the parsed JSON response body.
 *
 * ### Request lifecycle
 * 1. Optionally resolves an auth token and injects it as a Bearer header.
 * 2. Performs the `fetch` call.
 * 3. On a **network error** (fetch rejects — e.g. offline, DNS failure):
 *    - Adds a Sentry breadcrumb tagged `network: true`.
 *    - Captures the exception in Sentry.
 *    - Re-throws the original error so call-sites can handle it.
 * 4. Parses the response body as JSON.
 * 5. Adds a Sentry breadcrumb with the HTTP status code.
 * 6. On an **HTTP error** (`!response.ok`):
 *    - Constructs a descriptive `Error` from the API's `error` field or the
 *      HTTP status text.
 *    - Captures the exception in Sentry for 5xx (server) errors only — 4xx
 *      errors are considered client-side mistakes and are not captured.
 *    - Throws the constructed error.
 * 7. On success, returns the parsed response data.
 *
 * @async
 * @function apiFetch
 *
 * @param {string}          path - Absolute path of the API endpoint, starting
 *   with a leading slash (e.g. `"/users/42"`).  Concatenated directly with
 *   {@link base}.
 * @param {ApiFetchOptions} [opts={}] - Optional request configuration.
 *
 * @returns {Promise<unknown>} Resolves with the parsed JSON body of a
 *   successful response.
 *
 * @throws {Error} Throws when:
 *   - The `fetch` call rejects (network-level failure).
 *   - The server returns a non-2xx HTTP status code.
 *
 * @example <caption>Simple unauthenticated GET request</caption>
 * const data = await apiFetch("/health");
 *
 * @example <caption>Authenticated POST request with a body</caption>
 * const user = await apiFetch("/users", {
 *   method: "POST",
 *   body: { name: "Alice", email: "alice@example.com" },
 *   getToken: () => auth.getAccessToken(),
 * });
 *
 * @example <caption>Handling errors at the call-site</caption>
 * try {
 *   const data = await apiFetch("/protected-resource", { getToken });
 * } catch (err) {
 *   // Could be a network error or an HTTP error (4xx / 5xx).
 *   console.error("API call failed:", err.message);
 * }
 */
export async function apiFetch(path, opts = {}) {
  const { getToken, method = "GET", body } = opts;

  /** @type {Record<string, string>} */
  const headers = { "Content-Type": "application/json" };

  // ── Authentication ────────────────────────────────────────────────────────
  // If a token getter was provided, resolve it and conditionally attach the
  // Authorization header. A falsy token (null, undefined, "") is ignored so
  // that unauthenticated states do not send a malformed header.
  if (getToken) {
    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  // ── Network request ───────────────────────────────────────────────────────
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      // Only serialize the body when it has been explicitly provided;
      // passing `undefined` to `fetch` is equivalent to omitting the field
      // entirely, which is required for methods like GET and HEAD.
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // fetch() only rejects on network-level failures (no response received).
    // HTTP error status codes do NOT cause a rejection — those are handled
    // further down after the response is parsed.

    // Record a breadcrumb so we have request context in Sentry's timeline.
    Sentry.addBreadcrumb({
      category: "api",
      message: `${method} ${path}`,
      level: "error",
      data: { network: true }, // flag distinguishes network vs HTTP errors
    });

    // Capture the full exception so we get a stack trace in Sentry.
    Sentry.captureException(e, {
      tags: { "api.fetch": "network" },
      extra: { path, method },
    });

    throw e; // propagate to call-site — nothing more we can do here
  }

  // ── Response parsing ──────────────────────────────────────────────────────
  // Always parse the body as JSON. The API contract requires a JSON body even
  // for error responses so that structured error messages can be extracted.
  const data = await res.json();

  // Leave a breadcrumb regardless of success/failure so that Sentry's issue
  // timeline always reflects which API calls were made before an error.
  Sentry.addBreadcrumb({
    category: "api",
    message: `${method} ${path}`,
    level: res.ok ? "info" : "warning",
    data: { status: res.status },
  });

  // ── HTTP error handling ───────────────────────────────────────────────────
  if (!res.ok) {
    // Prefer the structured error message from the response body; fall back to
    // the HTTP status text (e.g. "Not Found") when none is available.
    const msg = typeof data?.error === "string" ? data.error : res.statusText;
    const err = new Error(typeof msg === "string" ? msg : "Request failed");

    // Only report server-side (5xx) errors to Sentry. Client errors (4xx) are
    // typically caused by incorrect usage and should be handled by the caller
    // rather than generating noise in the error tracker.
    if (res.status >= 500) {
      Sentry.captureException(err, {
        tags: { "api.fetch": "http", "http.status": String(res.status) },
        extra: { path, method, status: res.status },
      });
    }

    throw err;
  }

  // ── Success ───────────────────────────────────────────────────────────────
  return data;
}
