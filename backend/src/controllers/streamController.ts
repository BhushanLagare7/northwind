/**
 * @file streamController.ts
 * @description Controller for generating Stream Chat authentication tokens.
 * Handles user authentication via Clerk and synchronizes user data with
 * Stream Chat before issuing access tokens.
 */

import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

import { getEnv } from "../lib/env.js";
import {
  getStreamChatServer,
  streamChatDisplayName,
  streamUserId,
} from "../lib/stream.js";
import { getLocalUser } from "../lib/users.js";

/** Load and cache environment variables at module initialization */
const env = getEnv();

/**
 * Express controller that generates a Stream Chat authentication token
 * for an authenticated user.
 *
 * @description This controller performs the following steps:
 * 1. Validates the user's Clerk authentication session
 * 2. Verifies the user exists in the local database
 * 3. Fetches the user's profile from Clerk
 * 4. Upserts the user in Stream Chat with their display name and avatar
 * 5. Generates and returns a Stream Chat token along with connection details
 *
 * @param {Request}      req  - Express request object containing Clerk auth session
 * @param {Response}     res  - Express response object
 * @param {NextFunction} next - Express next middleware function for error handling
 *
 * @returns {Promise<void>} Resolves when the response has been sent
 *
 * @throws Will forward any unexpected errors to the Express error handler
 *         via the `next` callback
 *
 * @example
 * // Route registration
 * router.post("/token", createStreamToken);
 *
 * @example
 * // Successful response payload
 * {
 *   token:   "eyJhbGciOiJIUzI1...", // Stream Chat JWT
 *   apiKey:  "abc123xyz",            // Public Stream API key
 *   userId:  "stream_user_abc",      // Stream-formatted user ID
 *   name:    "Jane Doe"              // Resolved display name
 * }
 *
 * @example
 * // 401 response — user is not authenticated
 * { "error": "Unauthorized" }
 *
 * @example
 * // 503 response — user authenticated but not yet synced to local DB
 * { "error": "Account not synced yet" }
 */
export async function createStreamToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    /* ------------------------------------------------------------------ */
    /* 1. Authentication guard                                            */
    /* ------------------------------------------------------------------ */

    const { userId, isAuthenticated } = getAuth(req);

    if (!isAuthenticated || !userId) {
      // Clerk session is missing or invalid — reject early
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    /* ------------------------------------------------------------------ */
    /* 2. Local database lookup                                           */
    /* ------------------------------------------------------------------ */

    /**
     * The local user record is required to determine the user's role and
     * preferred display name. A missing record typically means the Clerk
     * webhook has not yet propagated (eventual consistency).
     */
    const localUser = await getLocalUser(userId);

    if (!localUser) {
      // User exists in Clerk but has not been synced to the local DB yet
      res.status(503).json({ error: "Account not synced yet" });
      return;
    }

    /* ------------------------------------------------------------------ */
    /* 3. Stream Chat server instance                                     */
    /* ------------------------------------------------------------------ */

    /** Server-side Stream Chat client initialized with server credentials */
    const server = getStreamChatServer(env);

    /* ------------------------------------------------------------------ */
    /* 4. Clerk profile fetch & display-name resolution                   */
    /* ------------------------------------------------------------------ */

    /** Full Clerk user object containing profile metadata */
    const clerkUser = await clerkClient.users.getUser(userId);

    /**
     * Attempt to build a full name from Clerk's first/last name fields.
     * Falls back to `null` when both fields are absent so that downstream
     * logic can choose an alternative (username, email, etc.).
     */
    const combined =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      null;

    /**
     * Resolve the final display name according to the user's role and
     * available profile data. Priority order (handled inside the helper):
     *   localUser.displayName → combined full name → clerkUser.username → email
     */
    const name = streamChatDisplayName(
      localUser.role,
      localUser.displayName ?? combined ?? clerkUser.username,
      localUser.email,
    );

    /** User's avatar URL sourced from Clerk; `undefined` if not set */
    const image = clerkUser.imageUrl || undefined;

    /**
     * Stream Chat requires its own user ID format.
     * `streamUserId` prefixes / sanitizes the Clerk userId accordingly.
     */
    const sid = streamUserId(userId);

    /* ------------------------------------------------------------------ */
    /* 5. Upsert user in Stream Chat                                      */
    /* ------------------------------------------------------------------ */

    /**
     * Create or update the Stream Chat user profile to keep display name
     * and avatar in sync with the latest Clerk data.
     */
    await server.upsertUser({ id: sid, name, image });

    /* ------------------------------------------------------------------ */
    /* 6. Token generation & response                                     */
    /* ------------------------------------------------------------------ */

    /**
     * Generate a server-side Stream Chat JWT for the client to use when
     * connecting to Stream's WebSocket infrastructure.
     */
    const token = server.createToken(sid);

    res.json({
      token, // Stream Chat JWT for client-side initialization
      apiKey: env.STREAM_API_KEY, // Public key required by the Stream client SDK
      userId: sid, // Stream-formatted user ID
      name, // Resolved display name for immediate UI use
    });
  } catch (e) {
    /**
     * Delegate any unhandled errors (network failures, SDK errors, etc.)
     * to the global Express error-handling middleware.
     */
    next(e);
  }
}
