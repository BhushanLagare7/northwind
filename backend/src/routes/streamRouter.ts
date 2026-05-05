import { Router } from "express";

import { createStreamToken } from "../controllers/streamController";

const router = Router();

/**
 * @route POST /api/stream/token
 * @description Generates a Stream Chat authentication token for the authenticated user.
 * @access Private (requires valid Clerk session)
 */
router.post("/token", createStreamToken);

export default router;
