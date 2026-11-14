import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { config } from "../config.js";

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: `A file exceeds the ${config.MAX_FILE_MB}MB limit`,
      LIMIT_FILE_COUNT: `Too many files (max ${config.MAX_FILES})`,
      LIMIT_UNEXPECTED_FILE: 'Unexpected upload field; use the "files" field',
    };
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: messages[err.code] ?? err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
