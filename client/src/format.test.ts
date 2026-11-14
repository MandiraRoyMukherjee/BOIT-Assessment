import { describe, expect, it } from "vitest";
import { analysisToMarkdown } from "./format";
import type { AnalysisResponse } from "./types";

const analysis: AnalysisResponse = {
  id: "a1",
  prompt: "Compare the documents",
  status: "completed",
  createdAt: "2026-01-01T00:00:00.000Z",
  documents: [
    { id: "d1", filename: "form.txt", sizeBytes: 10, status: "processed", chunkCount: 1, truncated: false },
    { id: "d2", filename: "scan.pdf", sizeBytes: 10, status: "unreadable", reason: "No text", chunkCount: 0, truncated: false },
  ],
  result: {
    provider: "mock",
    summary: "One conflict found.",
    warnings: ["something was dropped"],
    findings: [
      {
        type: "discrepancy",
        label: "Company differs",
        value: 'D1: "Acme Ltd"; D2: "Acme Limited"',
        kind: "interpretation",
        sources: [
          { documentId: "d1", filename: "form.txt", role: "supports", ref: "line 1", quote: "Company: Acme Ltd", verified: true },
          { documentId: "d3", filename: "licence.pdf", role: "supports", ref: "page 1", quote: "Company: Acme Limited", verified: true },
        ],
      },
      {
        type: "key_value",
        label: "Company",
        value: "Acme Ltd",
        kind: "fact",
        sources: [{ documentId: "d1", filename: "form.txt", role: "supports", ref: "line 1", quote: "Company: Acme Ltd", verified: true }],
      },
    ],
    comparisonTable: {
      columns: [{ documentId: "d1", filename: "form.txt" }, { documentId: "d3", filename: "licence.pdf" }],
      rows: [
        {
          attribute: "Company",
          cells: [
            { documentId: "d1", entries: [{ value: "Acme Ltd", ref: "line 1", quote: "Company: Acme Ltd" }] },
            { documentId: "d3", entries: [] },
          ],
        },
      ],
    },
  },
};

describe("analysisToMarkdown", () => {
  const md = analysisToMarkdown(analysis);

  it("labels AI interpretation separately from extracted facts", () => {
    expect(md).toContain("## Discrepancies (AI interpretation)");
    expect(md).toContain("## Extracted facts (verbatim from documents)");
  });

  it("includes the source document, location and quote for each finding", () => {
    expect(md).toContain("Sources: form.txt, line 1; licence.pdf, page 1");
    expect(md).toContain('"Company: Acme Limited" (licence.pdf, page 1)');
  });

  it("lists unreadable documents with their reason and renders the table with empty cells", () => {
    expect(md).toContain("- scan.pdf: unreadable (No text)");
    expect(md).toContain("| Attribute | form.txt | licence.pdf |");
    expect(md).toContain("| Company | Acme Ltd (line 1) | — |");
  });

  it("includes warnings", () => {
    expect(md).toContain("- something was dropped");
  });
});
