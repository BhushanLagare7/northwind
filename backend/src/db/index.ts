import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import "dotenv/config";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL");
}

const pool = new pg.Pool({ connectionString: databaseUrl });

export const db = drizzle(pool, { schema });
