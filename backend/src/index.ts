import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";

import "dotenv/config";
import keepAliveCron from "./lib/cron";
import { getEnv } from "./lib/env";
import checkoutRouter from "./routes/checkoutRouter";
import meRouter from "./routes/meRouter";
import productRouter from "./routes/productRouter";
import streamRouter from "./routes/streamRouter";
import { clerkWebhookHandler } from "./webhooks/clerk";

const env = getEnv();
const app = express();

const rawJson = express.raw({ type: "application/json", limit: "1mb" });

// It's important that you don't parse the webhook event data, it should be in the raw format
app.post("/webhooks/clerk", rawJson, (req, res) => {
  void clerkWebhookHandler(req, res);
});
// app.post("/webhooks/polar", rawJson, (req, res) => {
//   void polarWebhookHandler(req, res);
// });

app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/me", meRouter);
app.use("/api/products", productRouter);
app.use("/api/stream", streamRouter);
app.use("/api/checkout", checkoutRouter);

const publicDir = path.join(process.cwd(), "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  app.get("/{*any}", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }

    if (req.path.startsWith("/api") || req.path.startsWith("/webhooks")) {
      next();
      return;
    }

    res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
  });
}

// TODO: Add error handling middleware

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
  if (env.NODE_ENV === "production") {
    keepAliveCron.start();
  }
});
