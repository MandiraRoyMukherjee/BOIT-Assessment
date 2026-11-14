import type { AnalysisResponse, AnalysisResult } from "../domain/types.js";
import { toDocumentReport, type AnalysisRepository, type NewDocument } from "./types.js";

/** In-memory repository for tests. */
export class MemoryAnalysisRepository implements AnalysisRepository {
  private readonly analyses = new Map<string, AnalysisResponse>();
  private counter = 0;

  async createAnalysis(prompt: string): Promise<{ id: string; createdAt: string }> {
    const id = `a-${++this.counter}`;
    const createdAt = new Date().toISOString();
    this.analyses.set(id, { id, prompt, status: "failed", createdAt, documents: [] });
    return { id, createdAt };
  }

  async addDocument(analysisId: string, doc: NewDocument): Promise<string> {
    const analysis = this.analyses.get(analysisId);
    if (!analysis) throw new Error("unknown analysis");
    const id = `d-${analysis.documents.length + 1}`;
    analysis.documents.push(toDocumentReport(id, doc));
    return id;
  }

  async completeAnalysis(analysisId: string, result: AnalysisResult): Promise<void> {
    const analysis = this.analyses.get(analysisId);
    if (analysis) Object.assign(analysis, { status: "completed", result });
  }

  async failAnalysis(analysisId: string, error: string): Promise<void> {
    const analysis = this.analyses.get(analysisId);
    if (analysis) Object.assign(analysis, { status: "failed", error });
  }

  async getAnalysis(analysisId: string): Promise<AnalysisResponse | null> {
    return this.analyses.get(analysisId) ?? null;
  }
}
