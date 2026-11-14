import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import type { LLMProvider } from "../llm/types.js";
import type { AnalysisRepository } from "../repository/types.js";
import { runAnalysis } from "../services/runAnalysis.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_FILE_MB * 1024 * 1024, files: config.MAX_FILES },
});

const promptSchema = z.object({
  prompt: z
    .string({ required_error: "Prompt is required" })
    .trim()
    .min(1, "Prompt is required")
    .max(2000, "Prompt must be at most 2000 characters"),
});

const idSchema = z.string().regex(/^[\w-]{1,64}$/);

export function createAnalysesRouter(deps: { repo: AnalysisRepository; provider: LLMProvider }): Router {
  const router = Router();

  router.post("/", upload.array("files"), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedPrompt = promptSchema.safeParse(req.body);
      if (!parsedPrompt.success) {
        res.status(400).json({ error: parsedPrompt.error.issues[0]?.message ?? "Invalid prompt" });
        return;
      }
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) {
        res.status(400).json({ error: "At least one file is required" });
        return;
      }

      const outcome = await runAnalysis(deps, parsedPrompt.data.prompt, files);
      if (outcome.ok) {
        res.status(201).json(outcome.response);
      } else {
        res.status(outcome.httpStatus).json({
          error: outcome.error,
          analysisId: outcome.analysisId,
          documents: outcome.documents,
        });
      }
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params["id"] ?? "";
      if (!idSchema.safeParse(id).success) {
        res.status(400).json({ error: "Invalid analysis id" });
        return;
      }
      const analysis = await deps.repo.getAnalysis(id);
      if (!analysis) {
        res.status(404).json({ error: "Analysis not found" });
        return;
      }
      res.json(analysis);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
