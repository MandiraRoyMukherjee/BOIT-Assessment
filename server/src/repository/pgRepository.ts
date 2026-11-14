import type { AnalysisResponse, AnalysisResult, DocumentKind, DocumentReport, DocumentStatus } from "../domain/types.js";
import { getPool } from "../db.js";
import type { AnalysisRepository, NewDocument } from "./types.js";

interface AnalysisRow {
  id: string;
  prompt: string;
  status: "pending" | "completed" | "failed";
  result: AnalysisResult | null;
  error: string | null;
  created_at: Date;
}

interface DocumentRow {
  id: string;
  filename: string;
  size_bytes: number;
  status: DocumentStatus;
  mime_type: string;
  error: string | null;
  chunk_count: number;
  truncated: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Derives the document kind from the stored (already validated and sanitised) file name. */
function kindFromFilename(filename: string): DocumentKind | undefined {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "txt") return "text";
  if (ext === "csv") return "csv";
  return undefined;
}

export class PgAnalysisRepository implements AnalysisRepository {
  async createAnalysis(prompt: string): Promise<{ id: string; createdAt: string }> {
    const { rows } = await getPool().query<{ id: string; created_at: Date }>(
      "INSERT INTO analyses (prompt) VALUES ($1) RETURNING id, created_at",
      [prompt],
    );
    const row = rows[0];
    if (!row) throw new Error("Failed to create analysis");
    return { id: row.id, createdAt: row.created_at.toISOString() };
  }

  async addDocument(analysisId: string, doc: NewDocument): Promise<string> {
    const text = doc.chunks.map((c) => c.text).join("\n");
    const { rows } = await getPool().query<{ id: string }>(
      `INSERT INTO documents
         (analysis_id, filename, mime_type, size_bytes, status, error, extracted_text, chunks, chunk_count, truncated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
       RETURNING id`,
      [
        analysisId,
        doc.filename,
        doc.mimeType,
        doc.sizeBytes,
        doc.status,
        doc.reason ?? null,
        text || null,
        JSON.stringify(doc.chunks),
        doc.chunks.length,
        doc.truncated,
      ],
    );
    const row = rows[0];
    if (!row) throw new Error("Failed to store document");
    return row.id;
  }

  async completeAnalysis(analysisId: string, result: AnalysisResult): Promise<void> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE analyses SET status = 'completed', result = $2::jsonb WHERE id = $1", [
        analysisId,
        JSON.stringify(result),
      ]);
      for (const f of result.findings) {
        await client.query(
          "INSERT INTO findings (analysis_id, type, label, value, kind, sources) VALUES ($1, $2, $3, $4, $5, $6::jsonb)",
          [analysisId, f.type, f.label, f.value, f.kind, JSON.stringify(f.sources)],
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async failAnalysis(analysisId: string, error: string): Promise<void> {
    await getPool().query("UPDATE analyses SET status = 'failed', error = $2 WHERE id = $1", [analysisId, error]);
  }

  async getAnalysis(analysisId: string): Promise<AnalysisResponse | null> {
    if (!UUID.test(analysisId)) return null;
    const pool = getPool();
    const analysis = await pool.query<AnalysisRow>(
      "SELECT id, prompt, status, result, error, created_at FROM analyses WHERE id = $1",
      [analysisId],
    );
    const row = analysis.rows[0];
    if (!row) return null;

    const docs = await pool.query<DocumentRow>(
      `SELECT id, filename, size_bytes, status, mime_type, error, chunk_count, truncated
         FROM documents WHERE analysis_id = $1 ORDER BY created_at, filename`,
      [analysisId],
    );
    const documents: DocumentReport[] = docs.rows.map((d) => ({
      id: d.id,
      filename: d.filename,
      sizeBytes: d.size_bytes,
      status: d.status,
      kind: kindFromFilename(d.filename),
      reason: d.error ?? undefined,
      chunkCount: d.chunk_count,
      truncated: d.truncated,
    }));

    return {
      id: row.id,
      prompt: row.prompt,
      status: row.status === "completed" ? "completed" : "failed",
      createdAt: row.created_at.toISOString(),
      documents,
      result: row.result ?? undefined,
      error: row.error ?? undefined,
    };
  }
}
