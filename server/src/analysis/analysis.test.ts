import { describe, expect, it } from "vitest";
import type { AnalysisDocument } from "./analyzeDocuments.js";
import { analyzeDocuments } from "./analyzeDocuments.js";
import { locateQuote } from "./locateQuote.js";
import { LLMError, type LLMProvider, type RawAnalysis, type RawExtraction } from "../llm/types.js";
import { MockProvider } from "../llm/mockProvider.js";
import { OpenAIProvider } from "../llm/openaiProvider.js";

const form: AnalysisDocument = {
  id: "doc-form",
  filename: "application-form.txt",
  chunks: [{ ref: "lines 1-3", text: "Company: Acme Trading Ltd\nRevenue: 1200000\nCity: Leeds" }],
};
const licence: AnalysisDocument = {
  id: "doc-licence",
  filename: "licence.txt",
  chunks: [{ ref: "lines 1-2", text: "Company: Acme Trade Limited\nRevenue: 1200000" }],
};

describe("locateQuote", () => {
  it("finds a quote ignoring case and whitespace and returns the chunk ref", () => {
    expect(locateQuote(form.chunks, "company:   acme trading ltd")).toBe("lines 1-3");
  });

  it("returns null for text that is not in the document", () => {
    expect(locateQuote(form.chunks, "Company: Globex")).toBeNull();
  });

  it("narrows CSV chunks to the exact row", () => {
    const chunks = [{ ref: "rows 2-3", text: "[row 2] Name: A | Amount: 10\n[row 3] Name: B | Amount: 99" }];
    expect(locateQuote(chunks, "Amount: 99")).toBe("row 3");
  });
});

describe("analyzeDocuments with the mock provider", () => {
  it("reports a discrepancy with sources from both documents and keeps facts separate from interpretation", async () => {
    const result = await analyzeDocuments(new MockProvider(), "compare", [form, licence]);

    const discrepancy = result.findings.find((f) => f.type === "discrepancy");
    expect(discrepancy?.kind).toBe("interpretation");
    expect(discrepancy?.sources.map((s) => s.filename).sort()).toEqual(["application-form.txt", "licence.txt"]);
    expect(discrepancy?.sources.every((s) => s.verified && !!s.quote && !!s.ref)).toBe(true);

    // Identical revenue figures must not be flagged.
    expect(result.findings.some((f) => f.type === "discrepancy" && f.label.startsWith("Revenue"))).toBe(false);

    const facts = result.findings.filter((f) => f.type === "key_value");
    expect(facts.length).toBe(5);
    expect(facts.every((f) => f.kind === "fact")).toBe(true);
  });

  it("reports information missing from one document", async () => {
    const result = await analyzeDocuments(new MockProvider(), "compare", [form, licence]);
    const missing = result.findings.find((f) => f.type === "missing_info" && f.label.startsWith("City"));
    expect(missing?.sources.find((s) => s.role === "absent")?.filename).toBe("licence.txt");
  });

  it("builds a comparison table with one column per document", async () => {
    const result = await analyzeDocuments(new MockProvider(), "compare", [form, licence]);
    expect(result.comparisonTable.columns.map((c) => c.filename)).toEqual(["application-form.txt", "licence.txt"]);
    const company = result.comparisonTable.rows.find((r) => r.attribute === "Company");
    expect(company?.cells.map((c) => c.entries[0]?.value)).toEqual(["Acme Trading Ltd", "Acme Trade Limited"]);
  });
});

describe("analyzeDocuments guards against bad model output", () => {
  const hallucinating: LLMProvider = {
    name: "test",
    async extractFacts(): Promise<RawExtraction> {
      return {
        facts: [
          { label: "Company", value: "Acme Trading Ltd", quote: "Company: Acme Trading Ltd" },
          { label: "Director", value: "John Smith", quote: "Director: John Smith" }, // not in the document
        ],
      };
    },
    async analyze(): Promise<RawAnalysis> {
      return {
        summary: "s",
        findings: [
          { type: "discrepancy", label: "Made up", description: "d", factIds: ["F99", "F98"], absentFromDocuments: [] },
        ],
      };
    },
  };

  it("discards facts whose quote is not in the document and findings citing unknown facts", async () => {
    const result = await analyzeDocuments(hallucinating, "x", [form]);
    expect(result.findings.filter((f) => f.type === "key_value")).toHaveLength(1);
    expect(result.findings.some((f) => f.type === "discrepancy")).toBe(false);
    expect(result.warnings.join(" ")).toContain("quote was not found");
    expect(result.warnings.join(" ")).toContain("did not cite enough valid evidence");
  });

  it("keeps going when one document fails and says so", async () => {
    const flaky: LLMProvider = {
      name: "flaky",
      async extractFacts({ document }): Promise<RawExtraction> {
        if (document.filename === "licence.txt") throw new LLMError("boom");
        return { facts: [{ label: "City", value: "Leeds", quote: "City: Leeds" }] };
      },
      async analyze(): Promise<RawAnalysis> {
        return { summary: "ok", findings: [] };
      },
    };
    const result = await analyzeDocuments(flaky, "x", [form, licence]);
    expect(result.warnings.join(" ")).toContain('"licence.txt" could not be analysed: boom');
    expect(result.comparisonTable.columns).toHaveLength(1);
  });

  it("throws when every document fails", async () => {
    const down: LLMProvider = {
      name: "down",
      async extractFacts(): Promise<RawExtraction> {
        throw new LLMError("provider down");
      },
      async analyze(): Promise<RawAnalysis> {
        throw new LLMError("provider down");
      },
    };
    await expect(analyzeDocuments(down, "x", [form])).rejects.toThrow("provider down");
  });
});

describe("OpenAIProvider", () => {
  const reply = (content: string): Response =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

  const make = (fetchImpl: typeof fetch): OpenAIProvider =>
    new OpenAIProvider({ apiKey: "k", model: "m", baseUrl: "http://x/v1", timeoutMs: 1000, fetchImpl });

  const input = { prompt: "p", document: { ref: "D1", filename: "a.txt" }, chunks: [{ ref: "line 1", text: "A: b" }] };

  it("retries once when the first reply is not valid against the schema", async () => {
    const replies = ["not json", JSON.stringify({ facts: [{ label: "A", value: "b", quote: "A: b" }] })];
    let calls = 0;
    const provider = make(async () => reply(replies[calls++] as string));
    const result = await provider.extractFacts(input);
    expect(calls).toBe(2);
    expect(result.facts).toHaveLength(1);
  });

  it("fails with a safe message after two invalid replies", async () => {
    const provider = make(async () => reply('{"facts":"nope"}'));
    await expect(provider.extractFacts(input)).rejects.toThrow("did not match the required structure");
  });

  it("maps HTTP errors without leaking details", async () => {
    const provider = make(async () => new Response("secret upstream body", { status: 429 }));
    await expect(provider.extractFacts(input)).rejects.toThrow("HTTP 429");
  });
});
