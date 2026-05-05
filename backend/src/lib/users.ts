import { eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { users } from "../db/schema.js";

/**
 * RETRIEVES A LOCAL USER RECORD FROM THE DATABASE BY THEIR CLERK USER ID.
 * @param clerkUserId - The unique Clerk user ID to look up.
 * @returns The matching user record, or `undefined` if not found.
 */
export async function getLocalUser(clerkUserId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  return user;
}
