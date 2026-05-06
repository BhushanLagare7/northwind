import { getAuth } from "@clerk/express";
import * as Sentry from "@sentry/node";
import type { RequestHandler } from "express";

/**
 * Middleware to link the Clerk user ID with Sentry error reports.
 */
export const sentryClerkUserMiddleware: RequestHandler = (req, _res, next) => {
  // Retrieve auth data from Clerk
  const { userId } = getAuth(req);

  // Set user context in Sentry's current isolation scope
  Sentry.getIsolationScope().setUser(userId ? { id: userId } : null);

  next();
};
