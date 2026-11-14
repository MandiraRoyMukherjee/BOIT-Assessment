import pg from "pg";
import { config } from "./config.js";

if (!config.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

export async function closeDb(): Promise<void> {
  await pool.end();
}
