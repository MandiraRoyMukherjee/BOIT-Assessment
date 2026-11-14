import type { AnalysisResponse, DocumentReport } from "../domain/types.js";
import { analyzeDocuments, type AnalysisDocument } from "../analysis/analyzeDocuments.js";
import { LLMError, type LLMProvider } from "../llm/types.js";
import { ParseError, parseDocument } from "../pipeline/index.js";
import { toDocumentReport, type AnalysisRepository, type NewDocument } from "../repository/types.js";
import { validateFile, type UploadedFileLike } from "../validation/fileValidation.js";

export interface RunAnalysisDeps {
  repo: AnalysisRepository;
  provider: LLMProvider;
}

export type RunAnalysisOutcome =
  | { ok: true; response: AnalysisResponse }
  | { ok: false; httpStatus: 422 | 502; error: string; documents: DocumentReport[]; analysisId: string };

/** Validates and parses each file independently, stores the outcome, then runs the two-pass analysis. */
export async function runAnalysis(
  deps: RunAnalysisDeps,
  prompt: string,
  files: UploadedFileLike[],
): Promise<RunAnalysisOutcome> {
  const { repo, provider } = deps;
  const { id: analysisId } = await repo.createAnalysis(prompt);

  const reports: DocumentReport[] = [];
  const analysable: AnalysisDocument[] = [];

  for (const file of files) {
    const validation = validateFile(file);
    const base = { mimeType: file.mimetype, sizeBytes: file.size, chunks: [], truncated: false };
    let doc: NewDocument;

    if (!validation.ok) {
      doc = { ...base, filename: validation.safeName, status: validation.status, reason: validation.reason };
    } else {
      try {
        const parsed = await parseDocument(validation.kind, file.buffer);
        doc = {
          ...base,
          filename: validation.safeName,
          status: "processed",
          kind: validation.kind,
          chunks: parsed.chunks,
          truncated: parsed.truncated,
        };
      } catch (err) {
        const reason = err instanceof ParseError ? err.message : "The document could not be processed.";
        doc = { ...base, filename: validation.safeName, status: "unreadable", kind: validation.kind, reason };
      }
    }

    const id = await repo.addDocument(analysisId, doc);
    reports.push(toDocumentReport(id, doc));
    if (doc.status === "processed") analysable.push({ id, filename: doc.filename, chunks: doc.chunks });
  }

  if (analysable.length === 0) {
    const error = "None of the uploaded documents could be read.";
    await repo.failAnalysis(analysisId, error);
    return { ok: false, httpStatus: 422, error, documents: reports, analysisId };
  }

  try {
    const result = await analyzeDocuments(provider, prompt, analysable);
    await repo.completeAnalysis(analysisId, result);
  } catch (err) {
    if (!(err instanceof LLMError)) throw err;
    await repo.failAnalysis(analysisId, err.message);
    return { ok: false, httpStatus: 502, error: err.message, documents: reports, analysisId };
  }

  const stored = await repo.getAnalysis(analysisId);
  if (!stored) throw new Error("Analysis disappeared after completion");
  return { ok: true, response: stored };
}
