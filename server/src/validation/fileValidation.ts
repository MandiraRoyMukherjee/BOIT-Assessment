import path from "node:path";
import type { DocumentKind } from "../domain/types.js";

export type { DocumentKind };
export type RejectionStatus = "unsupported" | "invalid";

export type ValidationResult =
  | { ok: true; kind: DocumentKind; safeName: string }
  | { ok: false; status: RejectionStatus; reason: string; safeName: string };

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Extension allowlist, with the client-declared MIME types we accept for each.
 * The declared MIME is client-controlled, so it is only a hint: generic
 * "application/octet-stream" is tolerated and content sniffing does the real check.
 */
const GENERIC_MIME = "application/octet-stream";
const ALLOWED: Record<string, { kind: DocumentKind; mimes: string[] }> = {
  ".pdf": { kind: "pdf", mimes: ["application/pdf", GENERIC_MIME] },
  ".txt": { kind: "text", mimes: ["text/plain", GENERIC_MIME] },
  ".csv": {
    kind: "csv",
    mimes: ["text/csv", "application/vnd.ms-excel", "text/plain", GENERIC_MIME],
  },
};

const PDF_MAGIC = Buffer.from("%PDF-");
const BINARY_SNIFF_BYTES = 8192;

/** Strips directories and unsafe characters so the name is safe to store and display. */
export function sanitizeFilename(original: string): string {
  const base = path.basename(original.replace(/\\/g, "/"));
  const cleaned = base
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 100);
  return cleaned || "unnamed";
}

function looksBinary(buffer: Buffer): boolean {
  return buffer.subarray(0, BINARY_SNIFF_BYTES).includes(0);
}

/** Validates a single upload. Never throws: failures are returned so one bad file does not fail the batch. */
export function validateFile(file: UploadedFileLike): ValidationResult {
  const safeName = sanitizeFilename(file.originalname);
  const reject = (status: RejectionStatus, reason: string): ValidationResult => ({
    ok: false,
    status,
    reason,
    safeName,
  });

  const rule = ALLOWED[path.extname(safeName).toLowerCase()];
  if (!rule) {
    return reject("unsupported", "Unsupported file type. Allowed: PDF, TXT, CSV.");
  }
  if (!rule.mimes.includes(file.mimetype)) {
    return reject("invalid", `Declared type "${file.mimetype}" does not match the file extension.`);
  }
  if (file.size === 0 || file.buffer.length === 0) {
    return reject("invalid", "File is empty.");
  }
  if (rule.kind === "pdf") {
    if (!file.buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      return reject("invalid", "File content is not a valid PDF.");
    }
  } else if (looksBinary(file.buffer)) {
    return reject("invalid", "File appears to be binary, not text.");
  }

  return { ok: true, kind: rule.kind, safeName };
}
