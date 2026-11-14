import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { config } from "../config.js";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

interface HttpLikeError {
  status?: number;
  type?: string;
}

/**
 * Central error handler. Known client errors get a specific message; everything else returns
 * a generic 500 so internals (stack traces, SQL, upstream bodies) never reach the client.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: `A file exceeds the ${config.MAX_FILE_MB}MB limit`,
      LIMIT_FILE_COUNT: `Too many files (max ${config.MAX_FILES})`,
      LIMIT_UNEXPECTED_FILE: 'Unexpected upload field; use the "files" field',
    };
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: messages[err.code] ?? "Invalid upload" });
    return;
  }

  const http = err as HttpLikeError;
  if (http?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed request body" });
    return;
  }
  if (http?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body too large" });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
};
