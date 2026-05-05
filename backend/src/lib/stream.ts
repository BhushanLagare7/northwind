/**
 * @file stream.ts
 * @description Utility functions for integrating with the Stream Chat service.
 * Provides helpers for user ID transformation, display name formatting based on
 * user roles, and server-side Stream Chat client instantiation.
 */

import { StreamChat } from "stream-chat";

import type { UserRole } from "../db/schema.js";
import type { Env } from "./env.js";

/**
 * Formats a user's display name for Stream Chat based on their role.
 *
 * @description
 * Applies role-based prefixes to distinguish admin and support staff in the chat UI.
 * Regular users see only their base display name without any prefix.
 *
 * The base name is derived from either the user's custom `displayName` or,
 * when unavailable, the local part of their email address (the portion before "@").
 *
 * Role prefix mapping:
 * - `admin`   → "Admin · {base}"
 * - `support` → "Support · {base}"
 * - `user`    → "{base}" (no prefix)
 *
 * @param {UserRole}      role        - The user's role: "admin" | "support" | "user"
 * @param {string | null} displayName - Optional custom display name from user profile
 * @param {string}        email       - User's email address (fallback for base name)
 *
 * @returns {string} The formatted display name with role prefix (if applicable)
 *
 * @example
 * // Admin with custom display name
 * streamChatDisplayName("admin", "Jane Doe", "jane@example.com")
 * // → "Admin · Jane Doe"
 *
 * @example
 * // Support user without display name (uses email local-part)
 * streamChatDisplayName("support", null, "john.smith@company.com")
 * // → "Support · john.smith"
 *
 * @example
 * // Regular user with display name
 * streamChatDisplayName("user", "Alice", "alice@example.com")
 * // → "Alice"
 *
 * @example
 * // Regular user without display name
 * streamChatDisplayName("user", null, "bob@example.com")
 * // → "bob"
 */
export function streamChatDisplayName(
  role: UserRole,
  displayName: string | null,
  email: string,
): string {
  /**
   * Base name derivation:
   * 1. Use the provided `displayName` if available
   * 2. Otherwise, extract the local-part from the email (text before "@")
   *
   * Example: "john.doe@company.com" → "john.doe"
   */
  const base = displayName ?? email.split("@")[0];

  // Apply role-specific prefixes for staff members
  if (role === "admin") return `Admin · ${base}`;
  if (role === "support") return `Support · ${base}`;

  // Regular users have no prefix
  return base;
}

/**
 * Returns a singleton instance of the Stream Chat server-side client.
 *
 * @description
 * Initializes a server-authenticated Stream Chat client using the API key and
 * secret from the application environment. This client has elevated privileges
 * and should **only** be used in server-side contexts (never exposed to the browser).
 *
 * The Stream SDK's `getInstance` method ensures that multiple calls with the
 * same credentials return the same client instance (singleton pattern), preventing
 * redundant network connections.
 *
 * **Security Note:**
 * The `STREAM_API_SECRET` grants full administrative access to your Stream Chat
 * application. Never send this value to the client or log it in plaintext.
 *
 * @param {Env} env - Environment configuration object containing Stream credentials
 *
 * @returns {StreamChat} Singleton server-side Stream Chat client instance
 *
 * @example
 * const server = getStreamChatServer(env);
 *
 * // Upsert a user (server-only operation)
 * await server.upsertUser({
 *   id: "user_123",
 *   name: "Jane Doe",
 *   image: "https://example.com/avatar.jpg"
 * });
 *
 * // Generate a client token
 * const token = server.createToken("user_123");
 */
export function getStreamChatServer(env: Env): StreamChat {
  /**
   * `getInstance` returns a cached singleton when called with the same
   * API key and secret, avoiding redundant client instantiation.
   */
  return StreamChat.getInstance(env.STREAM_API_KEY, env.STREAM_API_SECRET);
}

/**
 * Converts a Clerk user ID to a Stream Chat-compatible user ID.
 *
 * @description
 * Stream Chat requires unique user identifiers that are distinct from external
 * authentication providers. This function prefixes Clerk user IDs with `"clerk_"`
 * to namespace them and prevent collisions if multiple auth providers are used.
 *
 * The prefix also provides explicit traceability, making it clear in Stream Chat
 * logs and dashboards that a given user originates from Clerk.
 *
 * **ID Format:**
 * - Input:  Clerk user ID (e.g., `"user_2a3b4c5d6e7f"`)
 * - Output: Namespaced Stream user ID (e.g., `"clerk_user_2a3b4c5d6e7f"`)
 *
 * @param {string} clerkUserId - The unique user ID from Clerk authentication
 *
 * @returns {string} The prefixed user ID for use in Stream Chat operations
 *
 * @example
 * const streamId = streamUserId("user_2a3b4c5d6e7f");
 * console.log(streamId);
 * // → "clerk_user_2a3b4c5d6e7f"
 *
 * @example
 * // Use in Stream Chat operations
 * const sid = streamUserId(clerkUserId);
 * await server.upsertUser({ id: sid, name: "John Doe" });
 * const token = server.createToken(sid);
 */
export function streamUserId(clerkUserId: string): string {
  /**
   * The `clerk_` prefix ensures:
   * 1. No collision with user IDs from other providers (e.g., "auth0_", "firebase_")
   * 2. Clear audit trails in Stream's dashboard and logs
   * 3. Flexibility to migrate or support multiple auth systems in the future
   */
  return `clerk_${clerkUserId}`;
}
