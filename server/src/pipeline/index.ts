import type { Chunk, DocumentKind } from "../domain/types.js";
import { capChunks } from "./chunking.js";
import { csvParser } from "./parsers/csvParser.js";
import { pdfParser } from "./parsers/pdfParser.js";
import { textParser } from "./parsers/textParser.js";
import { ParseError, type DocumentParser } from "./types.js";

export { ParseError } from "./types.js";

/** Registry: add a parser here to support a new format. */
const parsers: Record<DocumentKind, DocumentParser> = {
  pdf: pdfParser,
  text: textParser,
  csv: csvParser,
};

export interface ParsedDocument {
  chunks: Chunk[];
  truncated: boolean;
  totalChars: number;
}

/** Parses a validated document into location-tagged, size-capped chunks. */
export async function parseDocument(kind: DocumentKind, buffer: Buffer): Promise<ParsedDocument> {
  const chunks = await parsers[kind].parse(buffer);
  if (chunks.every((c) => c.text.trim() === "")) {
    throw new ParseError("Document contains no readable text.");
  }
  const capped = capChunks(chunks);
  return {
    chunks: capped.chunks,
    truncated: capped.truncated,
    totalChars: capped.chunks.reduce((sum, c) => sum + c.text.length, 0),
  };
}
