import type { AnalysisResult, Chunk, Fact, Finding, Source } from "../domain/types.js";
import { batchChunks } from "../pipeline/chunking.js";
import { LLMError, type DocumentRef, type LLMProvider } from "../llm/types.js";
import { buildComparisonTable } from "./comparisonTable.js";
import { locateQuote } from "./locateQuote.js";

/** Max characters of document text sent to the model in one extraction call. */
const EXTRACT_BATCH_CHARS = 12000;
const MAX_FACTS_PER_DOC = 150;
const MAX_FACTS_FOR_ANALYSIS = 300;

export interface AnalysisDocument {
  id: string;
  filename: string;
  chunks: Chunk[];
}

const sourceFromFact = (fact: Fact): Source => ({
  documentId: fact.documentId,
  filename: fact.filename,
  role: "supports",
  ref: fact.ref,
  quote: fact.quote,
  verified: true,
});

/**
 * Two-pass analysis that never merges documents into one prompt:
 *  1. each document is sent alone to extract facts; quotes are verified server-side;
 *  2. only the verified facts (tagged with their document) are compared collectively.
 * Findings can only cite fact ids that exist, so provenance cannot be invented by the model.
 */
export async function analyzeDocuments(
  provider: LLMProvider,
  prompt: string,
  documents: AnalysisDocument[],
): Promise<AnalysisResult> {
  const warnings: string[] = [];
  const refs: DocumentRef[] = documents.map((d, i) => ({ ref: `D${i + 1}`, filename: d.filename }));

  // Pass 1: independent extraction per document (documents in parallel, batches in order).
  const settled = await Promise.allSettled(
    documents.map(async (doc, index) => {
      const ref = refs[index] as DocumentRef;
      const seen = new Set<string>();
      const kept: Omit<Fact, "id">[] = [];
      let dropped = 0;

      for (const batch of batchChunks(doc.chunks, EXTRACT_BATCH_CHARS)) {
        const extraction = await provider.extractFacts({ prompt, document: ref, chunks: batch });
        for (const raw of extraction.facts) {
          const location = locateQuote(doc.chunks, raw.quote);
          if (!location) {
            dropped++;
            continue;
          }
          const key = `${raw.label}|${raw.value}|${location}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          kept.push({
            documentId: doc.id,
            filename: doc.filename,
            label: raw.label,
            value: raw.value,
            ref: location,
            quote: raw.quote,
          });
        }
      }

      if (dropped > 0) {
        warnings.push(`${dropped} extracted item(s) from "${doc.filename}" were discarded because their quote was not found in the document.`);
      }
      if (kept.length > MAX_FACTS_PER_DOC) {
        warnings.push(`"${doc.filename}" produced more than ${MAX_FACTS_PER_DOC} facts; only the first ${MAX_FACTS_PER_DOC} were kept.`);
      }
      return kept.slice(0, MAX_FACTS_PER_DOC);
    }),
  );

  const perDocument: Omit<Fact, "id">[][] = [];
  const analysed: { doc: AnalysisDocument; ref: DocumentRef }[] = [];
  settled.forEach((outcome, index) => {
    const doc = documents[index] as AnalysisDocument;
    if (outcome.status === "fulfilled") {
      perDocument.push(outcome.value);
      analysed.push({ doc, ref: refs[index] as DocumentRef });
    } else {
      const reason = outcome.reason instanceof LLMError ? outcome.reason.message : "unexpected error";
      warnings.push(`"${doc.filename}" could not be analysed: ${reason}`);
    }
  });
  if (analysed.length === 0) {
    const firstFailure = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
    throw firstFailure?.reason instanceof LLMError ? firstFailure.reason : new LLMError("No document could be analysed.");
  }

  let counter = 0;
  const facts: Fact[] = perDocument.flat().map((f) => ({ ...f, id: `F${++counter}` }));
  const docById = new Map(analysed.map(({ doc, ref }) => [ref.ref, doc]));
  const factById = new Map(facts.map((f) => [f.id, f]));
  const tableDocs = analysed.map(({ doc }) => ({ id: doc.id, filename: doc.filename }));

  // Key-value findings: verified facts, no AI interpretation involved.
  const keyValues: Finding[] = facts.map((f) => ({
    type: "key_value",
    label: f.label,
    value: f.value,
    kind: "fact",
    sources: [sourceFromFact(f)],
  }));

  if (facts.length === 0) {
    warnings.push("No facts could be extracted from the uploaded documents.");
    return {
      provider: provider.name,
      summary: "No extractable facts were found, so no comparison could be made.",
      findings: [],
      comparisonTable: buildComparisonTable(tableDocs, facts),
      warnings,
    };
  }

  // Pass 2: collective analysis over verified facts only.
  const forAnalysis = facts.slice(0, MAX_FACTS_FOR_ANALYSIS);
  if (facts.length > forAnalysis.length) {
    warnings.push(`Only the first ${MAX_FACTS_FOR_ANALYSIS} of ${facts.length} facts were used for the comparison.`);
  }
  const analysis = await provider.analyze({
    prompt,
    documents: analysed.map(({ ref }) => ref),
    facts: forAnalysis.map((f) => ({
      id: f.id,
      docRef: analysed.find(({ doc }) => doc.id === f.documentId)?.ref.ref ?? "?",
      label: f.label,
      value: f.value,
      quote: f.quote,
    })),
  });

  const interpretations: Finding[] = [];
  let rejected = 0;
  for (const raw of analysis.findings) {
    const supporting = raw.factIds
      .map((id) => factById.get(id))
      .filter((f): f is Fact => f !== undefined)
      .map(sourceFromFact);
    const absent: Source[] = raw.absentFromDocuments.flatMap((ref) => {
      const doc = docById.get(ref);
      return doc ? [{ documentId: doc.id, filename: doc.filename, role: "absent" as const, verified: false }] : [];
    });

    const enoughEvidence = raw.type === "discrepancy" ? supporting.length >= 2 : supporting.length + absent.length >= 1;
    if (!enoughEvidence) {
      rejected++;
      continue;
    }
    interpretations.push({
      type: raw.type,
      label: raw.label,
      value: raw.description,
      kind: "interpretation",
      sources: [...supporting, ...absent],
    });
  }
  if (rejected > 0) {
    warnings.push(`${rejected} AI finding(s) were discarded because they did not cite enough valid evidence.`);
  }

  return {
    provider: provider.name,
    summary: analysis.summary,
    findings: [...interpretations, ...keyValues],
    comparisonTable: buildComparisonTable(tableDocs, facts),
    warnings,
  };
}
