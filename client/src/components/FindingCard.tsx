import type { Finding, Source } from "../types";

export function SourceBadge({ source }: { source: Source }) {
  const absent = source.role === "absent";
  const title = absent
    ? `${source.filename}: not found in this document`
    : `${source.filename}${source.ref ? ` — ${source.ref}` : ""}${source.quote ? `\n"${source.quote}"` : ""}`;
  return (
    <span className={`badge${absent ? " absent" : ""}`} title={title}>
      {source.filename}
      {absent ? " · absent" : source.ref ? ` · ${source.ref}` : ""}
    </span>
  );
}

/** One finding with a clear fact / AI-interpretation label and every supporting source with its quote. */
export function FindingCard({ finding }: { finding: Finding }) {
  const isFact = finding.kind === "fact";
  return (
    <li className="finding">
      <div className="finding-head">
        <strong>{finding.label}</strong>
        <span className={`tag ${isFact ? "fact" : "ai"}`}>{isFact ? "Extracted fact" : "AI interpretation"}</span>
      </div>
      <p>{finding.value}</p>
      <ul className="sources">
        {finding.sources.map((source, i) => (
          <li key={`${source.documentId}-${source.ref ?? "none"}-${i}`}>
            <SourceBadge source={source} />
            {source.quote && <span className="quote">“{source.quote}”</span>}
          </li>
        ))}
      </ul>
    </li>
  );
}
