/**
 * @file roles.ts
 * @description Utility helpers for working with application-level user roles.
 *
 * Roles are stored in the database as a plain string discriminated union
 * (`UserRole`) and originate from Clerk's `public_metadata.role` field, which
 * is an arbitrary `unknown` value at runtime. This module provides:
 *
 *   - A runtime-safe parser that coerces unrecognized values to a sane default.
 *   - Predicate helpers that encode role-hierarchy rules in a single place so
 *     that permission checks across the codebase remain consistent.
 *
 * Role hierarchy (ascending privilege):
 * ```
 *   customer  <  support  <  admin
 * ```
 *
 * @module roles
 */

import type { UserRole } from "../db/schema.js";

/**
 * Exhaustive list of every valid {@link UserRole} value.
 *
 * Keeping this tuple in sync with the database schema's discriminated union is
 * the single source of truth for runtime validation. If a new role is added to
 * the schema it **must** also be added here, otherwise `parseRole` will
 * silently downgrade users carrying that role to `"customer"`.
 *
 * The array is `readonly` to prevent accidental mutation at runtime and to
 * allow TypeScript to narrow element types without a type assertion on the
 * call-site.
 */
const VALID: readonly UserRole[] = ["customer", "support", "admin"];

/**
 * Safely parses an unknown value into a {@link UserRole}.
 *
 * This function is the **only** place where untrusted role data (e.g., values
 * read from Clerk's `public_metadata`) should be converted to a typed
 * `UserRole`. By centralizing the coercion here we avoid scattering `as
 * UserRole` casts — and the bugs they hide — throughout the codebase.
 *
 * Validation rules:
 *   - The value must be a `string` (non-string primitives and objects are
 *     rejected).
 *   - The string must be a member of {@link VALID} (case-sensitive).
 *   - Any value that fails either check is silently normalized to `"customer"`,
 *     the least-privileged role, so a misconfigured or missing metadata field
 *     can never accidentally grant elevated access.
 *
 * @param {unknown} value - The raw value to parse. Typically sourced from
 *                          `public_metadata.role` returned by the Clerk API.
 *
 * @returns {UserRole} The validated role, or `"customer"` as the safe default
 *                     fallback when validation fails.
 *
 * @example
 * parseRole("admin")     // → "admin"
 * parseRole("support")   // → "support"
 * parseRole("customer")  // → "customer"
 *
 * // Unrecognized / untrusted inputs all fall back to "customer":
 * parseRole("superuser") // → "customer"
 * parseRole(undefined)   // → "customer"
 * parseRole(null)        // → "customer"
 * parseRole(42)          // → "customer"
 * parseRole({})          // → "customer"
 */
export function parseRole(value: unknown): UserRole {
  if (
    typeof value === "string" &&
    (VALID as readonly string[]).includes(value)
  ) {
    /*
     * The double assertion (`VALID as readonly string[]`) is necessary because
     * TypeScript cannot narrow an `unknown` string to `UserRole` via
     * `Array.includes` alone — the generic overload of `includes` only accepts
     * the array's element type. Casting to `readonly string[]` widens the
     * accepted argument type while still performing the correct runtime check.
     *
     * After this guard we know `value` is a valid `UserRole`, so the
     * narrowing cast below is safe.
     */
    return value as UserRole;
  }

  // Fail-secure default: unknown roles are treated as the least privileged role.
  return "customer";
}

/**
 * Returns `true` when the given role has full administrative privileges.
 *
 * Use this predicate for operations that should be restricted to platform
 * administrators only (e.g., managing other users, accessing system settings).
 *
 * @param {UserRole} role - The role to test.
 *
 * @returns {boolean} `true` if `role` is `"admin"`, otherwise `false`.
 *
 * @example
 * isAdmin("admin")    // → true
 * isAdmin("support")  // → false
 * isAdmin("customer") // → false
 */
export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

/**
 * Returns `true` when the given role belongs to internal staff.
 *
 * "Staff" is defined as any role with elevated privileges above a regular
 * customer — currently `"support"` and `"admin"`. Use this predicate for
 * operations that any internal team member may perform (e.g., viewing support
 * queues, accessing customer details) without requiring full admin rights.
 *
 * Prefer {@link isAdmin} when the action should be locked down to admins only;
 * use `isStaff` when support agents and admins should both have access.
 *
 * @param {UserRole} role - The role to test.
 *
 * @returns {boolean} `true` if `role` is `"support"` or `"admin"`,
 *                    otherwise `false`.
 *
 * @example
 * isStaff("admin")    // → true  (admins are implicitly staff)
 * isStaff("support")  // → true
 * isStaff("customer") // → false
 */
export function isStaff(role: UserRole): boolean {
  return role === "support" || role === "admin";
}
