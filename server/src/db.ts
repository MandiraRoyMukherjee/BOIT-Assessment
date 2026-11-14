import pg from "pg";
import { config } from "./config.js";

let pool: pg.Pool | undefined;

/** Lazily creates the shared pool so importing the app never requires a database. */
export function getPool(): pg.Pool {
  if (!pool) {
    if (!config.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 5 });
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
