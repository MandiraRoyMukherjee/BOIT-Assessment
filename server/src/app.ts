import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import type { LLMProvider } from "./llm/types.js";
import { errorHandler } from "./middleware/errorHandler.js";
import type { AnalysisRepository } from "./repository/types.js";
import { createAnalysesRouter } from "./routes/analyses.js";

export interface AppDeps {
  repo: AnalysisRepository;
  provider: LLMProvider;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", provider: deps.provider.name });
  });
  app.use("/api/analyses", createAnalysesRouter(deps));

  app.use(errorHandler);
  return app;
}
