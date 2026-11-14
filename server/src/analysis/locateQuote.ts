import type { Chunk } from "../domain/types.js";

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Finds `quote` verbatim (ignoring case and whitespace differences) in the document's chunks.
 * Returns the location ref, or null when the quote does not occur: such facts are discarded,
 * which is how hallucinated evidence is kept out of the results.
 * For CSV chunks the ref narrows to the exact row via the `[row N]` markers.
 */
export function locateQuote(chunks: Chunk[], quote: string): string | null {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const pattern = new RegExp(words.map(escapeRegExp).join("\\s+"), "i");

  for (const chunk of chunks) {
    const match = pattern.exec(chunk.text);
    if (!match) continue;

    let rowRef: string | null = null;
    for (const marker of chunk.text.matchAll(/\[row (\d+)\]/g)) {
      if (marker.index > match.index) break;
      rowRef = `row ${marker[1]}`;
    }
    return rowRef ?? chunk.ref;
  }
  return null;
}
