import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import * as Sentry from "@sentry/react";

/**
 * Syncs the authenticated Clerk user ID with Sentry scope.
 * Ensures errors and session replays are associated with the correct user.
 */
export function SentryUserSync() {
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    // Set user ID in Sentry, or clear it if the user logs out
    Sentry.setUser(userId ? { id: userId } : null);
  }, [isLoaded, userId]);

  // This component handles logic only and does not render UI
  return null;
}
