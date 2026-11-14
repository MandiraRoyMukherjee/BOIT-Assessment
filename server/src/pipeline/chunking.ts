import type { Chunk } from "../domain/types.js";

/** Target size of one chunk, in characters. */
export const MAX_CHUNK_CHARS = 3000;
/** Upper bound on extracted text kept per document; the rest is dropped and flagged as truncated. */
export const MAX_DOC_CHARS = 48000;

export interface NumberedLine {
  n: number;
  text: string;
}

/** Splits a string into pieces of at most `max` characters. */
export function hardSplit(text: string, max: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += max) parts.push(text.slice(i, i + max));
  return parts.length > 0 ? parts : [""];
}

/**
 * Groups numbered lines (lines / rows) into chunks of at most `max` characters.
 * Over-long lines are split but keep their own line number, so refs stay accurate.
 */
export function chunkNumberedLines(
  lines: NumberedLine[],
  unit: string,
  max: number = MAX_CHUNK_CHARS,
): Chunk[] {
  const chunks: Chunk[] = [];
  let buffer: NumberedLine[] = [];
  let size = 0;

  const flush = (): void => {
    const first = buffer[0];
    const last = buffer[buffer.length - 1];
    if (!first || !last) return;
    const ref = first.n === last.n ? `${unit} ${first.n}` : `${unit}s ${first.n}-${last.n}`;
    chunks.push({ ref, text: buffer.map((l) => l.text).join("\n") });
    buffer = [];
    size = 0;
  };

  for (const line of lines) {
    for (const piece of hardSplit(line.text, max)) {
      if (size + piece.length + 1 > max && buffer.length > 0) flush();
      buffer.push({ n: line.n, text: piece });
      size += piece.length + 1;
    }
  }
  flush();
  return chunks;
}

/** Splits one page of text into chunks, labelled `page N` or `page N (part k)`. */
export function chunkPage(pageNumber: number, text: string, max: number = MAX_CHUNK_CHARS): Chunk[] {
  const pieces = hardSplit(text, max);
  return pieces.map((piece, i) => ({
    ref: pieces.length === 1 ? `page ${pageNumber}` : `page ${pageNumber} (part ${i + 1})`,
    text: piece,
  }));
}

/** Keeps chunks until the total character budget is used up. */
export function capChunks(
  chunks: Chunk[],
  maxChars: number = MAX_DOC_CHARS,
): { chunks: Chunk[]; truncated: boolean } {
  const kept: Chunk[] = [];
  let total = 0;
  for (const chunk of chunks) {
    if (total >= maxChars) return { chunks: kept, truncated: true };
    const remaining = maxChars - total;
    if (chunk.text.length > remaining) {
      kept.push({ ref: chunk.ref, text: chunk.text.slice(0, remaining) });
      return { chunks: kept, truncated: true };
    }
    kept.push(chunk);
    total += chunk.text.length;
  }
  return { chunks: kept, truncated: false };
}

/** Groups chunks into batches whose combined text stays within `maxChars` (for LLM calls). */
export function batchChunks(chunks: Chunk[], maxChars: number): Chunk[][] {
  const batches: Chunk[][] = [];
  let current: Chunk[] = [];
  let size = 0;
  for (const chunk of chunks) {
    if (size + chunk.text.length > maxChars && current.length > 0) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(chunk);
    size += chunk.text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
