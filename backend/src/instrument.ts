import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

import "dotenv/config";

// Retrieve the Sentry Data Source Name from environment variables
const dsn = process.env.SENTRY_DSN;

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Only runs if a SENTRY_DSN is provided in the environment.
 */
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    integrations: [nodeProfilingIntegration()],
    enableLogs: true,
    // Performance Monitoring: Capture 100% of transactions for debugging
    tracesSampleRate: 1.0,
    // Profiling: Capture 100% of sessions for performance analysis
    profileSessionSampleRate: 1.0,
    profileLifecycle: "trace",
    sendDefaultPii: true, // Includes personally identifiable information for better context
  });
}
