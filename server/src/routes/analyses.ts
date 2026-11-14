import { Router, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { validateFile, type DocumentKind } from "../validation/fileValidation.js";

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

interface FileReport {
  filename: string;
  sizeBytes: number;
  status: "accepted" | "unsupported" | "invalid";
  kind?: DocumentKind;
  reason?: string;
}

export const analysesRouter = Router();

analysesRouter.post("/", upload.array("files"), (req: Request, res: Response) => {
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

  const reports: FileReport[] = files.map((file) => {
    const result = validateFile(file);
    return result.ok
      ? { filename: result.safeName, sizeBytes: file.size, status: "accepted", kind: result.kind }
      : { filename: result.safeName, sizeBytes: file.size, status: result.status, reason: result.reason };
  });

  const accepted = reports.filter((r) => r.status === "accepted").length;
  if (accepted === 0) {
    res.status(422).json({ error: "No valid documents were uploaded", files: reports });
    return;
  }

  res.json({ prompt: parsedPrompt.data.prompt, files: reports });
});
