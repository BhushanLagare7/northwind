/**
 * @file main.jsx
 * @description Application entry point. Initializes Sentry monitoring, sets up
 * the React Query client, and renders the root application with all required
 * providers.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ClerkProvider } from "@clerk/react";
import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import App from "./App.jsx";
import { SentryErrorFallback } from "./components/SentryErrorFallback.jsx";
import { SentryUserSync } from "./components/SentryUserSync.jsx";

/** Shared React Query client instance used across the entire application. */
const queryClient = new QueryClient();

/**
 * Base URL for the API, read from the environment variable VITE_API_URL.
 * Falls back to an empty string when the variable is not set (i.e. same-origin).
 */
const apiBase = import.meta.env.VITE_API_URL ?? "";

/**
 * Determines which URLs Sentry should attach trace headers to, enabling
 * end-to-end (frontend → backend) distributed tracing.
 *
 * Priority:
 *  1. Explicit API base URL from the environment  →  trace that origin only.
 *  2. No explicit URL, running in a browser       →  trace the current origin.
 *  3. No explicit URL, non-browser environment    →  empty list (no tracing).
 */
const tracePropagationTargets =
  apiBase.length > 0
    ? [apiBase]
    : typeof window !== "undefined"
      ? [window.location.origin]
      : [];

/**
 * Initializes Sentry for error tracking, performance monitoring, and session
 * replay. All configuration values are injected at build time via Vite's
 * import.meta.env.
 *
 * Integrations
 * ─────────────────────────────────────────────────────────────────────────────
 * • browserTracingIntegration – Captures:
 *     - Page load & route-change timing
 *     - Slow frontend interactions (long tasks / INP)
 *     - Outgoing fetch / XHR request spans
 *     - Frontend-to-backend trace-context propagation
 *
 * • replayIntegration – Records a lightweight video-like replay of the user's
 *   session so bugs can be reproduced visually. Masking options are disabled
 *   here for development convenience; enable them in production as needed.
 *
 * Sample rates (1.0 = 100 %)
 * ─────────────────────────────────────────────────────────────────────────────
 * • tracesSampleRate        – Percentage of transactions sent to Sentry.
 * • replaysSessionSampleRate – Percentage of all sessions that are recorded.
 * • replaysOnErrorSampleRate – Percentage of sessions with errors that are
 *                              recorded (applied on top of the session rate).
 */
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  sendDefaultPii: true, // Includes user IP & cookies in reports.
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false, // Set to true to redact text in replays.
      maskAllInputs: false, // Set to true to redact form inputs in replays.
      blockAllMedia: false, // Set to true to hide images/video in replays.
    }),
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets,
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true, // Forward console logs to Sentry.
});

/**
 * Mount the React application into the #root element.
 *
 * Provider hierarchy (inner-most to outer-most):
 *  - Sentry.ErrorBoundary   – Catches unhandled render errors; shows a
 *                             friendly fallback UI instead of a blank screen.
 *  - BrowserRouter          – Enables client-side routing via React Router.
 *  - QueryClientProvider    – Provides the React Query cache to the tree.
 *  - SentryUserSync         – Keeps the Sentry "user" context in sync with
 *                             the currently authenticated Clerk user.
 *  - ClerkProvider          – Supplies authentication state from Clerk.
 *  - StrictMode             – Activates additional React runtime warnings
 *                             during development.
 */
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider>
      <SentryUserSync />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Sentry.ErrorBoundary fallback={<SentryErrorFallback />}>
            <App />
          </Sentry.ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
);
