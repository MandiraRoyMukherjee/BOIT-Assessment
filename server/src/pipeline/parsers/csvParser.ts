import Papa from "papaparse";
import type { Chunk } from "../../domain/types.js";
import { chunkNumberedLines } from "../chunking.js";
import { ParseError, type DocumentParser } from "../types.js";
import { decodeText } from "./textParser.js";

/**
 * Rows are rendered as `[row N] column: value | column: value` so every row is
 * self-describing (header names travel with the values) and quotable.
 */
export const csvParser: DocumentParser = {
  kind: "csv",
  async parse(buffer: Buffer): Promise<Chunk[]> {
    const parsed = Papa.parse<Record<string, string>>(decodeText(buffer), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });

    const lines = parsed.data
      .map((row, i) => {
        const cells = Object.entries(row)
          .filter(([key, value]) => key !== "" && typeof value === "string" && value.trim() !== "")
          .map(([key, value]) => `${key}: ${value.trim()}`);
        // Row numbers match spreadsheet numbering: the header is row 1.
        return { n: i + 2, text: cells.length > 0 ? `[row ${i + 2}] ${cells.join(" | ")}` : "" };
      })
      .filter((l) => l.text !== "");

    if (lines.length === 0) {
      throw new ParseError("CSV has no data rows.");
    }
    return chunkNumberedLines(lines, "row");
  },
};
