import type {
  AnalysisFact,
  AnalyzeInput,
  ExtractInput,
  LLMProvider,
  RawAnalysis,
  RawExtraction,
} from "./types.js";

/** Normalises for comparison: case, punctuation and spacing are ignored. */
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const KEY_VALUE = /^([A-Za-z][^:=\n]{1,60}?)\s*:\s*(\S.*)$/;
const CSV_ROW = /^\[row \d+\]\s*(.*)$/;
const MAX_FINDINGS_PER_TYPE = 20;

/** Splits a line into "label: value" segments; CSV rows are split on their " | " cell separator. */
function segments(line: string): string[] {
  const row = CSV_ROW.exec(line);
  return row ? (row[1] ?? "").split(" | ") : [line];
}

/**
 * Deterministic, rule-based stand-in for an LLM. It follows the same contract (verbatim quotes,
 * fact-id citations), so the whole pipeline can be demoed and tested without an API key.
 * It does not read the instruction; it extracts "Label: value" pairs and compares them by label.
 */
export class MockProvider implements LLMProvider {
  readonly name = "mock (rule-based, no LLM)";

  async extractFacts(input: ExtractInput): Promise<RawExtraction> {
    const facts: RawExtraction["facts"] = [];
    for (const chunk of input.chunks) {
      for (const line of chunk.text.split("\n")) {
        for (const segment of segments(line.trim())) {
          const match = KEY_VALUE.exec(segment.trim());
          if (!match) continue;
          facts.push({
            label: (match[1] ?? "").trim(),
            value: (match[2] ?? "").trim().slice(0, 500),
            quote: segment.trim().slice(0, 500),
          });
        }
      }
    }
    return { facts: facts.slice(0, 100) };
  }

  async analyze(input: AnalyzeInput): Promise<RawAnalysis> {
    const groups = new Map<string, AnalysisFact[]>();
    for (const fact of input.facts) {
      const key = norm(fact.label);
      groups.set(key, [...(groups.get(key) ?? []), fact]);
    }

    const discrepancies: RawAnalysis["findings"] = [];
    const missing: RawAnalysis["findings"] = [];

    for (const group of groups.values()) {
      const first = group[0];
      if (!first) continue;
      const byDoc = new Map<string, AnalysisFact[]>();
      for (const fact of group) byDoc.set(fact.docRef, [...(byDoc.get(fact.docRef) ?? []), fact]);
      const representatives = [...byDoc.values()].map((facts) => facts[0]).filter((f): f is AnalysisFact => !!f);

      const singleValuePerDoc = [...byDoc.values()].every((facts) => new Set(facts.map((f) => norm(f.value))).size === 1);
      const distinctValues = new Set(representatives.map((f) => norm(f.value)));
      if (byDoc.size >= 2 && singleValuePerDoc && distinctValues.size > 1) {
        discrepancies.push({
          type: "discrepancy",
          label: `${first.label} differs across documents`,
          description: representatives.map((f) => `${f.docRef}: "${f.value}"`).join("; "),
          factIds: representatives.map((f) => f.id),
          absentFromDocuments: [],
        });
      }

      const absent = input.documents.filter((d) => !byDoc.has(d.ref));
      if (input.documents.length >= 2 && absent.length > 0) {
        missing.push({
          type: "missing_info",
          label: `${first.label} not found in all documents`,
          description: `Present in ${representatives.map((f) => f.docRef).join(", ")}; not found in ${absent.map((d) => d.ref).join(", ")}.`,
          factIds: representatives.map((f) => f.id),
          absentFromDocuments: absent.map((d) => d.ref),
        });
      }
    }

    const findings = [
      ...discrepancies.slice(0, MAX_FINDINGS_PER_TYPE),
      ...missing.slice(0, MAX_FINDINGS_PER_TYPE),
    ];
    return {
      summary:
        `Compared ${input.documents.length} document(s) using ${input.facts.length} extracted fact(s). ` +
        `Found ${discrepancies.length} conflicting attribute(s) and ${missing.length} attribute(s) missing from at least one document. ` +
        `This summary was produced by the rule-based mock provider; set LLM_PROVIDER=openai for model-written analysis.`,
      findings,
    };
  }
}
