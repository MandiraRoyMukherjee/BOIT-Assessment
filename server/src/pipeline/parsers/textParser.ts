import type { Chunk } from "../../domain/types.js";
import { chunkNumberedLines } from "../chunking.js";
import { ParseError, type DocumentParser } from "../types.js";

/** Decodes UTF-8 text, rejecting content that is mostly undecodable (i.e. not really text). */
export function decodeText(buffer: Buffer): string {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer).replace(/^\uFEFF/, "");
  const replacements = (text.match(/\uFFFD/g) ?? []).length;
  if (text.length > 0 && replacements / text.length > 0.01) {
    throw new ParseError("File is not valid UTF-8 text.");
  }
  return text;
}

export const textParser: DocumentParser = {
  kind: "text",
  async parse(buffer: Buffer): Promise<Chunk[]> {
    const lines = decodeText(buffer)
      .split(/\r?\n/)
      .map((text, i) => ({ n: i + 1, text: text.trimEnd() }))
      .filter((l) => l.text.trim().length > 0);
    return chunkNumberedLines(lines, "line");
  },
};
