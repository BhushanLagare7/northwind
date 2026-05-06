import { clerkMiddleware } from "@clerk/express";
import * as Sentry from "@sentry/node";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";

import "dotenv/config";
import keepAliveCron from "./lib/cron";
import { getEnv } from "./lib/env";
import { sentryClerkUserMiddleware } from "./middleware/sentryClerkUser";
import adminRouter from "./routes/adminRouter";
import checkoutRouter from "./routes/checkoutRouter";
import meRouter from "./routes/meRouter";
import orderRouter from "./routes/orderRouter";
import productRouter from "./routes/productRouter";
import streamRouter from "./routes/streamRouter";
import { clerkWebhookHandler } from "./webhooks/clerk";
import { polarWebhookHandler } from "./webhooks/polar";

const env = getEnv();
const app = express();

/**
 * Raw JSON parser for webhook routes.
 * Webhooks require the raw, unparsed request body for signature verification.
 */
const rawJson = express.raw({ type: "application/json", limit: "1mb" });

// Webhook routes must be registered before express.json() to preserve raw body
app.post("/webhooks/clerk", rawJson, (req, res) => {
  void clerkWebhookHandler(req, res);
});
app.post("/webhooks/polar", rawJson, (req, res) => {
  void polarWebhookHandler(req, res);
});

// Global middleware
app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());
app.use(sentryClerkUserMiddleware); // Attaches authenticated Clerk user to Sentry scope

/** Health check endpoint — used by uptime monitors and load balancers */
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// API routes
app.use("/api/me", meRouter);
app.use("/api/products", productRouter);
app.use("/api/stream", streamRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/admin", adminRouter);
app.use("/api/orders", orderRouter);

/**
 * Serve static frontend files from the /public directory (if it exists).
 * All non-API, non-webhook GET requests fall through to index.html
 * to support client-side routing (e.g. React Router).
 */
const publicDir = path.join(process.cwd(), "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  app.get("/{*any}", (req, res, next) => {
    // Only handle GET and HEAD requests
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }

    // Let API and webhook requests fall through to their respective handlers
    if (req.path.startsWith("/api") || req.path.startsWith("/webhooks")) {
      next();
      return;
    }

    res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
  });
}

// Sentry error handler must be registered after routes and before other error handlers
Sentry.setupExpressErrorHandler(app);

/** Global error handler — returns a 500 with an optional Sentry event ID for tracing */
app.use(
  (
    _err: unknown,
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction,
  ) => {
    const sentryId = (res as express.Response & { sentry?: string }).sentry;

    res.status(500).json({
      error: "Internal server error",
      ...(sentryId !== undefined && { sentryId }),
    });
  },
);

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
  // Keep-alive cron prevents the server from spinning down on idle hosting platforms
  if (env.NODE_ENV === "production") {
    keepAliveCron.start();
  }
});
