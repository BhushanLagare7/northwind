/**
 * @fileoverview Express router for order API endpoints.
 * All routes are protected by {@link clerkMiddleware}
 *
 * Base path (mounted in the main app): `/api/orders`
 *
 * | Method   | Path                   | Description                          |
 * |----------|------------------------|--------------------------------------|
 * | `GET`    | `/`                    | List orders                          |
 * | `GET`    | `/:id`                 | Get a specific order                 |
 * | `POST`   | `/:id/stream-channel`  | Create a stream channel for the order|
 * | `POST`   | `/:id/video-invite`    | Send a video invite for the order    |
 */

import { Router } from "express";

import {
  createStreamChannel,
  createVideoInvite,
  getOrder,
  listOrders,
} from "../controllers/orderController";

const router = Router();

router.get("/", listOrders);
router.get("/:id", getOrder);
router.post("/:id/stream-channel", createStreamChannel);
router.post("/:id/video-invite", createVideoInvite);

export default router;
