-- Multi-Document Intelligence Workbench schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS analyses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'completed', 'failed')),
  result      JSONB,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id     UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'processed'
                  CHECK (status IN ('processed', 'unsupported', 'unreadable', 'invalid')),
  error           TEXT,
  extracted_text  TEXT,
  chunk_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS findings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id  UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  type         TEXT NOT NULL
               CHECK (type IN ('key_value', 'discrepancy', 'missing_info', 'comparison', 'summary')),
  label        TEXT NOT NULL,
  value        TEXT NOT NULL,
  -- 'fact' = extracted verbatim from a document; 'interpretation' = AI-generated reasoning
  kind         TEXT NOT NULL CHECK (kind IN ('fact', 'interpretation')),
  -- provenance: [{ "documentId": "...", "filename": "...", "ref": "page 2", "quote": "..." }]
  sources      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_analysis ON documents(analysis_id);
CREATE INDEX IF NOT EXISTS idx_findings_analysis ON findings(analysis_id);
