import type { ComparisonTable, Fact } from "../domain/types.js";

const MAX_ROWS = 200;
const MAX_ENTRIES_PER_CELL = 5;

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Builds the comparison table from verified facts only (no LLM involved), so every cell
 * is a fact with a document, location and quote. Rows present in most documents come first.
 */
export function buildComparisonTable(
  documents: { id: string; filename: string }[],
  facts: Fact[],
): ComparisonTable {
  const rows = new Map<string, { attribute: string; byDoc: Map<string, Fact[]> }>();
  for (const fact of facts) {
    const key = norm(fact.label);
    if (!key) continue;
    const row = rows.get(key) ?? { attribute: fact.label, byDoc: new Map<string, Fact[]>() };
    row.byDoc.set(fact.documentId, [...(row.byDoc.get(fact.documentId) ?? []), fact]);
    rows.set(key, row);
  }

  const built = [...rows.values()]
    .sort((a, b) => b.byDoc.size - a.byDoc.size || a.attribute.localeCompare(b.attribute))
    .slice(0, MAX_ROWS)
    .map((row) => ({
      attribute: row.attribute,
      cells: documents.map((doc) => ({
        documentId: doc.id,
        entries: (row.byDoc.get(doc.id) ?? [])
          .slice(0, MAX_ENTRIES_PER_CELL)
          .map((f) => ({ value: f.value, ref: f.ref, quote: f.quote })),
      })),
    }));

  return {
    columns: documents.map((d) => ({ documentId: d.id, filename: d.filename })),
    rows: built,
  };
}
