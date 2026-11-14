import { z } from "zod";
import type { Chunk } from "../domain/types.js";

/** Raised for any LLM failure (network, timeout, HTTP error, unparseable output). Messages are safe to show. */
export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMError";
  }
}

/** Pass 1 output: facts for ONE document. `quote` must be copied verbatim from the document. */
export const extractionSchema = z.object({
  facts: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        value: z.string().trim().min(1).max(500),
        quote: z.string().trim().min(1).max(500),
      }),
    )
    .max(100),
});
export type RawExtraction = z.infer<typeof extractionSchema>;

/** Pass 2 output. Findings reference fact ids (F1..) and document refs (D1..), never free text sources. */
export const analysisSchema = z.object({
  summary: z.string().trim().max(3000),
  findings: z
    .array(
      z.object({
        type: z.enum(["discrepancy", "missing_info"]),
        label: z.string().trim().min(1).max(160),
        description: z.string().trim().min(1).max(1000),
        factIds: z.array(z.string()).max(40).default([]),
        absentFromDocuments: z.array(z.string()).max(10).default([]),
      }),
    )
    .max(60),
});
export type RawAnalysis = z.infer<typeof analysisSchema>;

export interface DocumentRef {
  /** Short stable label used inside prompts, e.g. "D1". */
  ref: string;
  filename: string;
}

export interface ExtractInput {
  prompt: string;
  document: DocumentRef;
  chunks: Chunk[];
}

export interface AnalysisFact {
  id: string;
  docRef: string;
  label: string;
  value: string;
  quote: string;
}

export interface AnalyzeInput {
  prompt: string;
  documents: DocumentRef[];
  facts: AnalysisFact[];
}

export interface LLMProvider {
  readonly name: string;
  /** Pass 1: independent extraction from a single document (or a batch of its chunks). */
  extractFacts(input: ExtractInput): Promise<RawExtraction>;
  /** Pass 2: collective analysis over already-verified facts from all documents. */
  analyze(input: AnalyzeInput): Promise<RawAnalysis>;
}
