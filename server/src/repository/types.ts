import type {
  AnalysisResponse,
  AnalysisResult,
  Chunk,
  DocumentKind,
  DocumentReport,
  DocumentStatus,
} from "../domain/types.js";

export interface NewDocument {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  kind?: DocumentKind;
  reason?: string;
  chunks: Chunk[];
  truncated: boolean;
}

export interface StoredDocument extends NewDocument {
  id: string;
}

/** Persistence port. The Postgres implementation is in pgRepository.ts; tests use an in-memory fake. */
export interface AnalysisRepository {
  createAnalysis(prompt: string): Promise<{ id: string; createdAt: string }>;
  addDocument(analysisId: string, doc: NewDocument): Promise<string>;
  completeAnalysis(analysisId: string, result: AnalysisResult): Promise<void>;
  failAnalysis(analysisId: string, error: string): Promise<void>;
  getAnalysis(analysisId: string): Promise<AnalysisResponse | null>;
}

export function toDocumentReport(id: string, doc: NewDocument): DocumentReport {
  return {
    id,
    filename: doc.filename,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    kind: doc.kind,
    reason: doc.reason,
    chunkCount: doc.chunks.length,
    truncated: doc.truncated,
  };
}
