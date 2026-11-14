import type { AnalysisResponse, DocumentReport } from "./types";

export const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".csv"] as const;
export const MAX_FILE_MB = 2;
export const MAX_FILES = 5;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly documents?: DocumentReport[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  error?: string;
  documents?: DocumentReport[];
}

/** Uploads the files with the prompt and returns the analysis, or throws an ApiError with a readable message. */
export async function submitAnalysis(prompt: string, files: File[], signal?: AbortSignal): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append("prompt", prompt);
  for (const file of files) form.append("files", file);

  let response: Response;
  try {
    response = await fetch("/api/analyses", { method: "POST", body: form, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("Could not reach the server. Check that it is running and try again.");
  }

  const body = (await response.json().catch(() => ({}))) as ErrorBody & Partial<AnalysisResponse>;
  if (!response.ok) {
    throw new ApiError(body.error ?? `Request failed (HTTP ${response.status}).`, body.documents);
  }
  return body as AnalysisResponse;
}
