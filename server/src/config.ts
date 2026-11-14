import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Load the repo-root .env regardless of the workspace's working directory.
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().optional(),
  LLM_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  LLM_BASE_URL: z.string().default("https://api.openai.com/v1"),
  LLM_TIMEOUT_MS: z.coerce.number().default(30000),
  MAX_FILE_MB: z.coerce.number().default(2),
  MAX_FILES: z.coerce.number().default(5),
});

export const config = envSchema.parse(process.env);
