import { useState } from "react";
import { analysisToJson, analysisToMarkdown } from "../format";
import type { AnalysisResponse, ComparisonTable, Finding } from "../types";
import { CopyButton } from "./CopyButton";
import { FindingCard } from "./FindingCard";

type TabId = "discrepancy" | "missing_info" | "key_value" | "table";

function FindingList({ findings, empty }: { findings: Finding[]; empty: string }) {
  if (findings.length === 0) return <p className="muted">{empty}</p>;
  return (
    <ul className="findings">
      {findings.map((f, i) => (
        <FindingCard key={`${f.type}-${f.label}-${i}`} finding={f} />
      ))}
    </ul>
  );
}

function TableView({ table }: { table: ComparisonTable }) {
  if (table.rows.length === 0) return <p className="muted">No facts were extracted to compare.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Attribute</th>
            {table.columns.map((c) => (
              <th key={c.documentId}>{c.filename}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.attribute}>
              <th scope="row">{row.attribute}</th>
              {row.cells.map((cellData) => (
                <td key={cellData.documentId}>
                  {cellData.entries.length === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    cellData.entries.map((entry, i) => (
                      <div key={i} title={`“${entry.quote}”`}>
                        {entry.value} <span className="muted small">({entry.ref})</span>
                      </div>
                    ))
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResultsView({ analysis }: { analysis: AnalysisResponse }) {
  const [tab, setTab] = useState<TabId>("discrepancy");
  const result = analysis.result;

  const byType = (type: Finding["type"]): Finding[] => result?.findings.filter((f) => f.type === type) ?? [];
  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "discrepancy", label: "Discrepancies", count: byType("discrepancy").length },
    { id: "missing_info", label: "Missing information", count: byType("missing_info").length },
    { id: "key_value", label: "Extracted facts", count: byType("key_value").length },
    { id: "table", label: "Comparison table", count: result?.comparisonTable.rows.length },
  ];

  return (
    <section className="card" aria-live="polite">
      <div className="results-head">
        <h2>Results</h2>
        <div className="actions">
          <CopyButton label="Copy as Markdown" getText={() => analysisToMarkdown(analysis)} />
          <CopyButton label="Copy as JSON" getText={() => analysisToJson(analysis)} />
        </div>
      </div>

      <h3>Documents</h3>
      <ul className="doclist">
        {analysis.documents.map((d) => (
          <li key={d.id}>
            <span className={`status ${d.status}`}>{d.status}</span> {d.filename}
            {d.reason && <span className="muted small"> — {d.reason}</span>}
            {d.truncated && <span className="muted small"> — very large; only the first part was analysed</span>}
          </li>
        ))}
      </ul>

      {result && (
        <>
          <h3>
            Summary <span className="tag ai">AI interpretation</span>
          </h3>
          <p>{result.summary}</p>

          {result.warnings.length > 0 && (
            <div className="warnings" role="status">
              <strong>Warnings</strong>
              <ul>
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="tabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                className={tab === t.id ? "tab active" : "tab"}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.count !== undefined && <span className="count">{t.count}</span>}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {tab === "discrepancy" && <FindingList findings={byType("discrepancy")} empty="No discrepancies were found." />}
            {tab === "missing_info" && <FindingList findings={byType("missing_info")} empty="No missing information was found." />}
            {tab === "key_value" && <FindingList findings={byType("key_value")} empty="No facts were extracted." />}
            {tab === "table" && <TableView table={result.comparisonTable} />}
          </div>

          <p className="muted small">Generated with {result.provider}. Hover a source badge or table cell to see the quoted text.</p>
        </>
      )}
    </section>
  );
}
