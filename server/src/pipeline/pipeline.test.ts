import { describe, expect, it } from "vitest";
import { makePdf } from "../testUtils/makePdf.js";
import { batchChunks, capChunks, chunkNumberedLines, chunkPage } from "./chunking.js";
import { ParseError, parseDocument } from "./index.js";

describe("chunking", () => {
  it("keeps line numbers in refs and splits at the size limit", () => {
    const lines = Array.from({ length: 6 }, (_, i) => ({ n: i + 1, text: "x".repeat(40) }));
    const chunks = chunkNumberedLines(lines, "line", 100);
    expect(chunks.map((c) => c.ref)).toEqual(["lines 1-2", "lines 3-4", "lines 5-6"]);
  });

  it("splits an over-long line but keeps its line number", () => {
    const chunks = chunkNumberedLines([{ n: 7, text: "y".repeat(250) }], "line", 100);
    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.ref === "line 7")).toBe(true);
  });

  it("labels split pages with parts", () => {
    expect(chunkPage(2, "a".repeat(250), 100).map((c) => c.ref)).toEqual([
      "page 2 (part 1)",
      "page 2 (part 2)",
      "page 2 (part 3)",
    ]);
  });

  it("caps total size and flags truncation", () => {
    const result = capChunks([{ ref: "a", text: "x".repeat(60) }, { ref: "b", text: "y".repeat(60) }], 100);
    expect(result.truncated).toBe(true);
    expect(result.chunks.reduce((n, c) => n + c.text.length, 0)).toBe(100);
  });

  it("batches chunks for LLM calls", () => {
    const chunks = [1, 2, 3].map((i) => ({ ref: `c${i}`, text: "z".repeat(60) }));
    expect(batchChunks(chunks, 100)).toHaveLength(3);
    expect(batchChunks(chunks, 120)).toHaveLength(2);
    expect(batchChunks(chunks, 200)).toHaveLength(1);
  });
});

describe("parseDocument", () => {
  it("parses text into line-referenced chunks and skips blank lines", async () => {
    const parsed = await parseDocument("text", Buffer.from("Name: Acme\n\nCity: Leeds\n"));
    expect(parsed.chunks).toEqual([{ ref: "lines 1-3", text: "Name: Acme\nCity: Leeds" }]);
    expect(parsed.truncated).toBe(false);
  });

  it("rejects text that is not valid UTF-8", async () => {
    const bytes = Buffer.from(Array.from({ length: 50 }, (_, i) => 0x80 + (i % 40)));
    await expect(parseDocument("text", bytes)).rejects.toBeInstanceOf(ParseError);
  });

  it("renders CSV rows with headers and spreadsheet row numbers", async () => {
    const parsed = await parseDocument("csv", Buffer.from("Date,Amount\n2024-01-05,1200\n2024-01-06,300\n"));
    expect(parsed.chunks[0]?.ref).toBe("rows 2-3");
    expect(parsed.chunks[0]?.text).toBe(
      "[row 2] Date: 2024-01-05 | Amount: 1200\n[row 3] Date: 2024-01-06 | Amount: 300",
    );
  });

  it("rejects a CSV with only headers", async () => {
    await expect(parseDocument("csv", Buffer.from("a,b,c\n"))).rejects.toThrow("no data rows");
  });

  it("extracts text from a PDF page by page", async () => {
    const pdf = makePdf([["Licensee: Acme Trading Ltd", "Licence No: L-1001"], ["Expiry: 2026-03-01"]]);
    const parsed = await parseDocument("pdf", pdf);
    expect(parsed.chunks.map((c) => c.ref)).toEqual(["page 1", "page 2"]);
    expect(parsed.chunks[0]?.text).toContain("Licensee: Acme Trading Ltd");
    expect(parsed.chunks[1]?.text).toContain("Expiry: 2026-03-01");
  });

  it("reports a corrupt PDF as unreadable instead of crashing", async () => {
    const corrupt = Buffer.from("%PDF-1.4\nthis is not a real pdf body");
    await expect(parseDocument("pdf", corrupt)).rejects.toBeInstanceOf(ParseError);
  });

  it("reports a PDF without text as unreadable", async () => {
    await expect(parseDocument("pdf", makePdf([[]]))).rejects.toBeInstanceOf(ParseError);
  });
});
