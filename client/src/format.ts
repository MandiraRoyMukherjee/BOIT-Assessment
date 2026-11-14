import type { AnalysisResponse, ComparisonTable, Finding, Source } from "./types";

const cell = (text: string): string => text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

export function formatSource(source: Source): string {
  if (source.role === "absent") return `${source.filename} (not found in this document)`;
  return source.ref ? `${source.filename}, ${source.ref}` : source.filename;
}

function sourceList(sources: Source[]): string {
  return sources.map(formatSource).join("; ");
}

function findingsSection(title: string, findings: Finding[], withQuotes: boolean): string[] {
  if (findings.length === 0) return [];
  const lines = [`## ${title}`, ""];
  for (const f of findings) {
    lines.push(`- **${f.label}**: ${f.value}`);
    lines.push(`  - Sources: ${sourceList(f.sources)}`);
    if (withQuotes) {
      for (const s of f.sources) {
        if (s.quote) lines.push(`  - "${s.quote}" (${s.filename}, ${s.ref ?? "n/a"})`);
      }
    }
  }
  lines.push("");
  return lines;
}

export function comparisonTableToMarkdown(table: ComparisonTable): string[] {
  if (table.rows.length === 0) return [];
  const header = `| Attribute | ${table.columns.map((c) => cell(c.filename)).join(" | ")} |`;
  const divider = `| --- | ${table.columns.map(() => "---").join(" | ")} |`;
  const rows = table.rows.map((row) => {
    const cells = row.cells.map((c) =>
      c.entries.length === 0 ? "—" : cell(c.entries.map((e) => `${e.value} (${e.ref})`).join("; ")),
    );
    return `| ${cell(row.attribute)} | ${cells.join(" | ")} |`;
  });
  return ["## Comparison table (extracted facts)", "", header, divider, ...rows, ""];
}

/** Renders the analysis as Markdown, keeping facts and AI interpretation in clearly labelled sections. */
export function analysisToMarkdown(analysis: AnalysisResponse): string {
  const lines: string[] = ["# Document analysis", "", `**Instruction:** ${analysis.prompt}`, ""];

  lines.push("## Documents", "");
  for (const d of analysis.documents) {
    lines.push(`- ${d.filename}: ${d.status}${d.reason ? ` (${d.reason})` : ""}${d.truncated ? " (truncated: very large document)" : ""}`);
  }
  lines.push("");

  const result = analysis.result;
  if (!result) return lines.join("\n").trimEnd() + "\n";

  const byType = (type: Finding["type"]): Finding[] => result.findings.filter((f) => f.type === type);

  lines.push("## Summary (AI interpretation)", "", result.summary, "");
  lines.push(...findingsSection("Discrepancies (AI interpretation)", byType("discrepancy"), true));
  lines.push(...findingsSection("Missing information (AI interpretation)", byType("missing_info"), false));
  lines.push(...findingsSection("Extracted facts (verbatim from documents)", byType("key_value"), true));
  lines.push(...comparisonTableToMarkdown(result.comparisonTable));

  if (result.warnings.length > 0) {
    lines.push("## Warnings", "", ...result.warnings.map((w) => `- ${w}`), "");
  }
  lines.push(`_Generated with: ${result.provider}_`);
  return lines.join("\n").trimEnd() + "\n";
}

export function analysisToJson(analysis: AnalysisResponse): string {
  return JSON.stringify(analysis, null, 2);
}
