/**
 * Domain types shared by server and client (type-only imports on the client).
 * Keep this file free of runtime code and imports.
 */

export type DocumentKind = "pdf" | "text" | "csv";
export type DocumentStatus = "processed" | "unsupported" | "unreadable" | "invalid";
export type FindingType = "key_value" | "discrepancy" | "missing_info" | "summary";

/** "fact" = extracted verbatim from a document; "interpretation" = AI-generated reasoning. */
export type FindingKind = "fact" | "interpretation";

/** A slice of a document that keeps its location (page / line / row range). */
export interface Chunk {
  ref: string;
  text: string;
}

/** Pointer back to the exact place in an uploaded document that a finding relies on. */
export interface Source {
  documentId: string;
  filename: string;
  /** "supports": the document states it. "absent": the document lacks it (missing-information findings). */
  role: "supports" | "absent";
  ref?: string;
  quote?: string;
  /** True when the quote was found verbatim in the document text by the server. */
  verified: boolean;
}

/** A fact extracted from one document, with a server-verified quote and location. */
export interface Fact {
  id: string;
  documentId: string;
  filename: string;
  label: string;
  value: string;
  ref: string;
  quote: string;
}

export interface Finding {
  type: FindingType;
  label: string;
  value: string;
  kind: FindingKind;
  sources: Source[];
}

export interface TableEntry {
  value: string;
  ref: string;
  quote: string;
}

export interface TableCell {
  documentId: string;
  entries: TableEntry[];
}

export interface ComparisonRow {
  attribute: string;
  cells: TableCell[];
}

export interface ComparisonTable {
  columns: { documentId: string; filename: string }[];
  rows: ComparisonRow[];
}

export interface AnalysisResult {
  provider: string;
  /** AI-generated interpretation. */
  summary: string;
  findings: Finding[];
  /** Built only from verified extracted facts. */
  comparisonTable: ComparisonTable;
  warnings: string[];
}

export interface DocumentReport {
  id: string;
  filename: string;
  sizeBytes: number;
  status: DocumentStatus;
  kind?: DocumentKind;
  reason?: string;
  chunkCount: number;
  truncated: boolean;
}

export interface AnalysisResponse {
  id: string;
  prompt: string;
  status: "completed" | "failed";
  createdAt: string;
  documents: DocumentReport[];
  result?: AnalysisResult;
  error?: string;
}
