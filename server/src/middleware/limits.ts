import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";

/** Limits expensive analysis requests per client IP. */
export function createAnalysisRateLimiter(maxPerMinute: number): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: maxPerMinute,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a minute and try again." },
  });
}

/** Responds 503 if a request runs longer than `ms`, so a stuck LLM call cannot hang a connection. */
export function requestDeadline(ms: number): RequestHandler {
  return (_req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) res.status(503).json({ error: "The request took too long. Please try again." });
    }, ms);
    res.on("close", () => clearTimeout(timer));
    next();
  };
}
