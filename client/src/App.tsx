import { useRef, useState, type FormEvent } from "react";
import { ApiError, submitAnalysis } from "./api";
import { PromptInput } from "./components/PromptInput";
import { ResultsView } from "./components/ResultsView";
import { UploadZone } from "./components/UploadZone";
import type { AnalysisResponse, DocumentReport } from "./types";
import "./styles.css";

export function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedDocs, setFailedDocs] = useState<DocumentReport[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const controller = useRef<AbortController | null>(null);

  const canSubmit = files.length > 0 && prompt.trim().length > 0 && !loading;

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSubmit) return;
    controller.current?.abort();
    controller.current = new AbortController();

    setLoading(true);
    setError(null);
    setFailedDocs([]);
    setAnalysis(null);
    try {
      setAnalysis(await submitAnalysis(prompt.trim(), files, controller.current.signal));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      if (err instanceof ApiError && err.documents) setFailedDocs(err.documents);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <header>
        <h1>Multi-Document Intelligence Workbench</h1>
        <p className="muted">
          Upload documents, describe the analysis you need, and get findings that point back to the exact source.
        </p>
      </header>

      <form className="card" onSubmit={onSubmit}>
        <UploadZone files={files} disabled={loading} onChange={setFiles} />
        <PromptInput value={prompt} disabled={loading} onChange={setPrompt} />
        <div className="submit-row">
          <button type="submit" className="btn" disabled={!canSubmit}>
            {loading ? "Analysing…" : "Analyse documents"}
          </button>
          {loading && <span className="muted small">This can take a little while for large documents.</span>}
        </div>
      </form>

      {error && (
        <div className="card error" role="alert">
          <strong>{error}</strong>
          {failedDocs.length > 0 && (
            <ul className="doclist">
              {failedDocs.map((d) => (
                <li key={d.id}>
                  <span className={`status ${d.status}`}>{d.status}</span> {d.filename}
                  {d.reason && <span className="muted small"> — {d.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {analysis && <ResultsView analysis={analysis} />}
    </main>
  );
}
