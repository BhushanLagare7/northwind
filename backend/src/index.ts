import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express from "express";

import "dotenv/config";
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

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
