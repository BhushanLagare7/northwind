import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";

import "dotenv/config";
import keepAliveCron from "./lib/cron";
import { getEnv } from "./lib/env";
import { clerkWebhookHandler } from "./webhooks/clerk";

const env = getEnv();
const app = express();

const rawJson = express.raw({ type: "application/json", limit: "1mb" });

// It's important that you don't parse the webhook event data, it should be in the raw format
app.post("/webhooks/clerk", rawJson, (req, res) => {
  void clerkWebhookHandler(req, res);
});

app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

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

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
  if (env.NODE_ENV === "production") {
    keepAliveCron.start();
  }
});
