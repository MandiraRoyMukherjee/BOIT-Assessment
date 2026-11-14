import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { closeDb, getPool } from "../db.js";

const dbDir = fileURLToPath(new URL("../../db/", import.meta.url));
const withSeed = process.argv.includes("--seed");

async function run(): Promise<void> {
  const pool = getPool();
  await pool.query(await readFile(`${dbDir}schema.sql`, "utf8"));
  console.log("Schema applied");
  if (withSeed) {
    await pool.query(await readFile(`${dbDir}seed.sql`, "utf8"));
    console.log("Seed data applied");
  }
}

run()
  .catch((err: unknown) => {
    console.error("DB init failed:", err);
    process.exitCode = 1;
  })
  .finally(closeDb);
