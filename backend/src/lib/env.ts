/**
 * @module env
 * @description Environment configuration module that provides type-safe access to
 * environment variables using Zod schema validation. This module ensures all required
 * environment variables are present and correctly typed before the application starts.
 *
 * @example
 * // Import and use environment variables
 * import { getEnv } from './env';
 *
 * const env = getEnv();
 * console.log(env.PORT);        // number
 * console.log(env.DATABASE_URL); // string
 */

import { z } from "zod";

/**
 * Zod schema definition for all environment variables.
 *
 * @remarks
 * - `.coerce.number()` automatically converts string values to numbers,
 *   which is necessary because all process.env values are strings by default.
 * - Fields marked with `.optional()` are not required to be present in the environment.
 * - Fields with `.default()` will use the specified value if not provided.
 * - Fields with `.min(1)` ensure the string is not empty.
 */
const envSchema = z.object({
  /**
   * The current application environment.
   * Controls behavior such as logging, error handling, and optimizations.
   * @default "development"
   */
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  /**
   * The port number on which the server will listen.
   * Automatically coerced from string to number (e.g., "3001" → 3001).
   * @default 3001
   */
  PORT: z.coerce.number().default(3001),

  /**
   * The full connection string for the database.
   * Must be a non-empty string.
   * @example "postgresql://user:password@localhost:5432/mydb"
   */
  DATABASE_URL: z.string().min(1),

  /**
   * The publishable (public) key for Clerk authentication.
   * Safe to expose to the client side.
   * @see {@link https://clerk.com/docs}
   */
  CLERK_PUBLISHABLE_KEY: z.string().min(1),

  /**
   * The secret key for Clerk authentication.
   * Must be kept private and never exposed to the client side.
   * @see {@link https://clerk.com/docs}
   */
  CLERK_SECRET_KEY: z.string().min(1),

  /**
   * The webhook secret used to verify incoming Clerk webhook events.
   * Optional — only required if Clerk webhooks are configured.
   * @see {@link https://clerk.com/docs/integrations/webhooks}
   */
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  /**
   * The base URL of the frontend application.
   * Used for CORS configuration, redirects, and generating absolute URLs.
   * Must be a valid URL.
   * @example "https://app.example.com"
   */
  FRONTEND_URL: z.string().url(),

  /**
   * The access token for authenticating with the Polar API.
   * Optional — only required if Polar payment integration is enabled.
   * @see {@link https://docs.polar.sh}
   */
  POLAR_ACCESS_TOKEN: z.string().optional(),

  /**
   * The webhook secret used to verify incoming Polar webhook events.
   * Optional — only required if Polar webhooks are configured.
   * @see {@link https://docs.polar.sh/webhooks}
   */
  POLAR_WEBHOOK_SECRET: z.string().optional(),

  /**
   * The base URL for the Polar API.
   * Can be overridden to point to a staging or mock environment.
   * Must be a valid URL.
   * @default "https://api.polar.sh"
   */
  POLAR_API_BASE: z.string().url().default("https://api.polar.sh"),

  /**
   * The UUID of the Polar product used during checkout.
   * Must be a valid UUID format.
   * @example "123e4567-e89b-12d3-a456-426614174000"
   */
  // TODO: change to `z.string().uuid()`
  POLAR_CHECKOUT_PRODUCT_ID: z.string(),

  /**
   * The public API key for Stream (e.g., Stream Chat or Stream Activity Feeds).
   * @see {@link https://getstream.io/docs}
   */
  STREAM_API_KEY: z.string().min(1),

  /**
   * The secret API key for Stream.
   * Must be kept private and never exposed to the client side.
   * @see {@link https://getstream.io/docs}
   */
  STREAM_API_SECRET: z.string().min(1),

  /**
   * The public key for ImageKit image optimization and delivery service.
   * @see {@link https://docs.imagekit.io}
   */
  IMAGEKIT_PUBLIC_KEY: z.string().min(1),

  /**
   * The private key for ImageKit.
   * Must be kept private and never exposed to the client side.
   * @see {@link https://docs.imagekit.io}
   */
  IMAGEKIT_PRIVATE_KEY: z.string().min(1),

  /**
   * The URL endpoint for ImageKit media delivery.
   * Must be a valid URL.
   * @example "https://ik.imagekit.io/your_imagekit_id"
   */
  IMAGEKIT_URL_ENDPOINT: z.string().url(),

  /**
   * The Data Source Name (DSN) URL for Sentry error tracking.
   * Optional — only required if Sentry error monitoring is enabled.
   * Must be a valid URL if provided.
   * @see {@link https://docs.sentry.io/product/sentry-basics/dsn-explainer}
   * @example "https://examplePublicKey@o0.ingest.sentry.io/0"
   */
  SENTRY_DSN: z.string().url().optional(),
});

/**
 * TypeScript type representing the validated and parsed environment variables.
 * Automatically inferred from the Zod schema to ensure type safety.
 *
 * @example
 * function doSomething(env: Env) {
 *   console.log(env.PORT); // TypeScript knows this is a number
 * }
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates the current process environment variables against the schema.
 *
 * @returns {Env} The validated and typed environment variables object.
 *
 * @throws {Error} Throws an "Invalid environment variables" error if any required
 * variables are missing or if any values fail validation. Field-level errors are
 * logged to the console before throwing.
 *
 * @example
 * try {
 *   const env = loadEnv();
 *   console.log(env.DATABASE_URL);
 * } catch (error) {
 *   // Handle missing or invalid environment variables
 *   process.exit(1);
 * }
 */
export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // Log detailed field-level errors to help developers identify
    // which environment variables are missing or invalid
    console.error(parsed.error.flatten().fieldErrors);

    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

/**
 * Cached instance of the validated environment variables.
 * Initialized to null and populated on the first call to `getEnv()`.
 * Prevents redundant re-validation on subsequent calls.
 */
let cachedEnv: Env | null = null;

/**
 * Returns a cached, validated instance of the environment variables.
 * Validates and parses the environment on the first call, then returns
 * the cached result on all subsequent calls for optimal performance.
 *
 * @returns {Env} The validated and typed environment variables object.
 *
 * @throws {Error} Throws if the environment variables are invalid (on first call only).
 *
 * @example
 * // Safely access environment variables anywhere in the application
 * import { getEnv } from './env';
 *
 * const { DATABASE_URL, PORT, NODE_ENV } = getEnv();
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = loadEnv();
  }

  return cachedEnv;
}
