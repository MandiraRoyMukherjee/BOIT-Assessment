import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import type { LLMProvider } from "./llm/types.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { createAnalysisRateLimiter, requestDeadline } from "./middleware/limits.js";
import type { AnalysisRepository } from "./repository/types.js";
import { createAnalysesRouter } from "./routes/analyses.js";

export interface AppDeps {
  repo: AnalysisRepository;
  provider: LLMProvider;
}

/** Overall budget per analysis request: LLM calls (two passes) plus parsing and storage. */
const REQUEST_DEADLINE_MS = config.LLM_TIMEOUT_MS * 3;

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.disable("x-powered-by");
  // Behind Vercel's proxy the client IP comes from X-Forwarded-For; needed for per-IP rate limiting.
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", provider: deps.provider.name });
  });
  app.post("/api/analyses", createAnalysisRateLimiter(config.RATE_LIMIT_PER_MIN), requestDeadline(REQUEST_DEADLINE_MS));
  app.use("/api/analyses", createAnalysesRouter(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
