# Multi-Document Intelligence Workbench

Upload several documents (PDF, TXT, CSV), describe the analysis you want, and get structured findings in which **every finding points back to the document, location and quote that supports it**.

Design details (HLD, LLD, diagrams, API contract) are in [`architecture.md`](architecture.md).

## How it works

1. **Upload and validate.** Each file is checked on its own: extension allowlist, content sniffing (PDF magic bytes, binary check for text), size and count limits, filename sanitising. A bad file is reported per file and never fails the whole batch.
2. **Parse.** A parser per format turns each file into location-tagged chunks (`page 2`, `lines 1-12`, `row 5`). Large documents are chunked and capped.
3. **Pass 1, per-document extraction.** Each document is sent to the LLM **alone** to extract facts (`label`, `value`, verbatim `quote`). The server checks that each quote really occurs in that document and records where. Facts whose quote cannot be found are discarded.
4. **Pass 2, collective analysis.** Only the verified facts, each tagged with its document, are compared across documents. The model can only cite fact ids that exist, so it cannot invent evidence.
5. **Present.** Results are shown as a comparison table, discrepancies, missing-information report, key-value facts and a summary. They are clearly labelled **Extracted fact** (verbatim from a document) or **AI interpretation**. The user can copy the output as Markdown or JSON.

Documents are never merged into one prompt. Boundaries are kept end to end.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18, TypeScript (strict), Vite |
| Backend | Node.js 18+, Express, TypeScript (strict, ESM) |
| Database | PostgreSQL 16 (`pg`), run locally with Docker Compose |
| Validation | `zod` (config, request, and LLM output), `multer` (memory storage) |
| Parsing | `unpdf` (PDF, pdf.js based), `papaparse` (CSV), built-in UTF-8 decoding (TXT) |
| LLM | Pluggable provider: rule-based **mock** (default, no key) or any **OpenAI-compatible** API |
| Security | `helmet`, CORS allowlist, `express-rate-limit`, request deadline |
| Tests | `vitest`, `supertest` |

## Run locally

Prerequisites: Node.js 18 or newer (20 recommended), Docker (for Postgres).

```bash
# 1. install dependencies (npm workspaces: client + server)
npm install

# 2. create your env file (defaults work as-is with the mock LLM)
cp .env.example .env

# 3. start Postgres and create the schema (+ one seed example)
docker compose up -d
npm run db:seed -w server        # or: npm run db:init -w server  (schema only)

# 4. run the API (terminal 1) and the UI (terminal 2)
npm run dev:server               # http://localhost:4000
npm run dev:client               # http://localhost:5173
```

Open http://localhost:5173, drop in the files from [`samples/`](samples), pick an example instruction, and click **Analyse documents**.

Useful commands:

```bash
npm test                 # server + client tests
npm run typecheck        # strict TypeScript checks for both workspaces
npm run build            # production builds
npm run samples -w server   # regenerate the synthetic sample documents
```

### Environment variables

See [`.env.example`](.env.example). Key ones:

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | local Docker DB |
| `LLM_PROVIDER` | `mock` or `openai` | `mock` |
| `LLM_API_KEY` | API key (required when provider is `openai`) | empty |
| `LLM_MODEL`, `LLM_BASE_URL` | Model and OpenAI-compatible endpoint | `gpt-4o-mini`, OpenAI URL |
| `LLM_TIMEOUT_MS` | Per LLM call timeout | `30000` |
| `MAX_FILE_MB`, `MAX_FILES` | Upload limits | `2`, `5` |
| `RATE_LIMIT_PER_MIN` | Analysis requests per IP per minute | `10` |
| `CLIENT_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |

## Sample documents

[`samples/`](samples) holds four fully synthetic documents (fictional company, people and numbers) with deliberately planted differences:

| Planted difference | Where |
|---|---|
| Company name: "Northwind Trading Ltd" vs "Northwind Trade Limited" | form vs licence, accounts, bank statement |
| Address: "14 Harbour Road" vs "41 Harbour Road" | form vs licence |
| Licence number: `GL-20418` vs `GL-20481` | form vs licence |
| Annual revenue: 2,450,000 vs 1,980,000 | form vs accounts |
| Missing information | licence has no registration number; form has no licence expiry date |

## Completed functionality

- Multi-file upload (drag and drop), PDF + TXT + CSV (three formats).
- Per-file validation and graceful handling of unsupported, invalid, empty, corrupt or image-only PDFs.
- Modular parser pipeline with chunking and a size cap per document.
- Two-pass structured analysis with zod-validated model output and one automatic retry.
- Provenance: document, location (page / line / row) and verified quote on every finding; absent-from-document markers for missing information.
- Fact vs AI-interpretation distinction in the data model, UI and copied output.
- Comparison table, discrepancy list, missing-information report, key-value extraction, summary.
- Copy as Markdown or JSON.
- Persistence in Postgres, and `GET /api/analyses/:id` to re-fetch a result.
- Automated tests (49 across server and client).

## Assumptions

- Documents are small to medium (2 MB each, 5 per request) and contain machine-readable text.
- English-language documents; UTF-8 text.
- The user wants findings tied to quoted evidence more than a fluent narrative.
- The mock provider is acceptable for a demo when no LLM key is available.

## Known limitations

- **No OCR.** Scanned or image-only PDFs, and image files, are reported as unreadable.
- **The mock provider is not an LLM.** It extracts `Label: value` lines and compares by label. It ignores the instruction text and misses free-form prose. Use `LLM_PROVIDER=openai` for real analysis.
- **The OpenAI provider was tested only against a stubbed `fetch`** (retry, schema validation, error mapping), not against a live API.
- Synchronous processing: the request stays open while the LLM runs.
- The rate limiter keeps counters in memory, so on a multi-instance or serverless deployment limits are per instance.
- No authentication or per-user data separation. An analysis id works as an unguessable link.
- Very large documents are truncated (about 48,000 characters each); the UI and output say so.
- Upload limits (up to 5 × 2 MB) can exceed the request-body cap of some hosts (Vercel serverless: about 4.5 MB). Lower `MAX_FILE_MB` / `MAX_FILES` there.
- The client imports its types from the server's `domain/types.ts` by relative path (single source of truth, but couples the two workspaces).

## Security considerations

- Files are processed **in memory only**; nothing is written to disk and original bytes are not stored.
- Allowlist by extension plus content checks (PDF magic bytes, binary detection); the declared MIME type is treated as a hint only.
- Filenames are sanitised (path traversal, odd characters) before storage or display.
- Size, count and prompt-length limits; JSON body limit; per-IP rate limit; request deadline; LLM call timeout.
- All SQL is parameterised; ids are validated before queries.
- LLM output is untrusted: validated with zod, quotes are verified against the source text, findings must cite real fact ids. The extraction prompt tells the model to treat document text as data and ignore embedded instructions (mitigation, not a guarantee).
- Errors returned to clients are generic; details are logged server-side only. `helmet` headers, restricted CORS, `x-powered-by` disabled.
- Secrets come from environment variables; `.env` is git-ignored.
- Only synthetic data is included in the repo.

## Productionising

- Move analysis to a **background job queue** (status polling or server-sent events) instead of holding the HTTP request open.
- Store original files in **object storage** with a virus scan, encryption at rest, and retention rules; add OCR (for example a managed OCR service) for scanned documents.
- Add **authentication and tenant isolation**, plus audit logging of who analysed what.
- Use a **shared rate-limit store** (Redis), structured logging, metrics and tracing, and alerting on LLM error rate and latency.
- Versioned **database migrations** instead of the idempotent `schema.sql`.
- LLM: provider failover, token and cost budgets per request, evaluation sets for extraction accuracy, and a data-processing agreement for any real customer data.
- CI pipeline (typecheck, tests, dependency audit), infrastructure as code, and per-environment config.

## AI development tools used and my decisions

> **To complete before submitting.** Be specific and honest here.

- **AI tools used:** IBM Bob (code generation in this repo). _Add any others._
- **Decisions I made myself:** _For example: choosing the two-pass design, keeping documents separate in prompts, verifying quotes server-side, Postgres over SQLite, mock provider fallback, upload limits. Describe in your own words which of these were your calls and what you changed or rejected from the AI's suggestions._
