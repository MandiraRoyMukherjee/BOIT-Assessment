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

/** Pointer back to the exact place in an uploaded document that supports a finding. */
export interface Source {
  documentId: string;
  filename: string;
  ref?: string;
  quote?: string;
  /** True when the quote was found verbatim in the document text. */
  verified: boolean;
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
