import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

import "dotenv/config";

// Retrieve the Sentry Data Source Name from environment variables
const dsn = process.env.SENTRY_DSN;
const isProduction = process.env.NODE_ENV === "production";

/** Headers whose values should never leave the server. */
const REDACTED_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-forwarded-for",
]);

/**
 * Scrub sensitive headers from a Sentry event before it is sent.
 * Redacts authorization, cookie, and proxy headers from request data.
 */
function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const headers = event.request?.headers;
  if (headers) {
    for (const key of Object.keys(headers)) {
      if (REDACTED_HEADERS.has(key.toLowerCase())) {
        headers[key] = "[Redacted]";
      }
    }
  }
  return event;
}

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Only runs if a SENTRY_DSN is provided in the environment.
 */
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    integrations: [nodeProfilingIntegration()],

    // Only enable debug logs in non-production environments
    enableLogs: !isProduction,

    // PII: only send default PII in non-production for easier debugging
    sendDefaultPii: !isProduction,

    // Performance Monitoring: sample less aggressively in production
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // Profiling: reduce sampling in production to limit overhead
    profileSessionSampleRate: isProduction ? 0.1 : 1.0,
    profileLifecycle: "trace",

    // Scrub sensitive headers/data before sending events & logs
    beforeSend(event) {
      return scrubEvent(event);
    },
  });
}
