import { getAuth } from "@clerk/express";
import { Router } from "express";

import { getLocalUser } from "../lib/users";

const router = Router();

/**
 * GET /
 * RETURNS THE AUTHENTICATED USER'S LOCAL RECORD.
 *
 * @returns 200 - The local user record.
 * @returns 401 - If the request is unauthenticated or missing a user ID.
 */
router.get("/", async (req, res, next) => {
  try {
    const { userId, isAuthenticated } = getAuth(req);

    // Reject requests from unauthenticated users
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await getLocalUser(userId);

    res.json({ user });
  } catch (e) {
    // Forward any unexpected errors to the error-handling middleware
    next(e);
  }
});

export default router;
