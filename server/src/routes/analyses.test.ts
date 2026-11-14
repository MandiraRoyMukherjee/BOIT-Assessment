import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { MockProvider } from "../llm/mockProvider.js";
import { LLMError, type LLMProvider } from "../llm/types.js";
import { MemoryAnalysisRepository } from "../repository/memoryRepository.js";
import { makePdf } from "../testUtils/makePdf.js";

const build = (provider: LLMProvider = new MockProvider()) =>
  createApp({ repo: new MemoryAnalysisRepository(), provider });

const form = Buffer.from("Company: Acme Trading Ltd\nAddress: 1 High Street, Leeds\nRevenue: 1200000");
const licence = makePdf([["Company: Acme Trade Limited", "Address: 1 High Street, Leeds", "Licence No: L-1001"]]);

describe("POST /api/analyses", () => {
  it("analyses a text file and a PDF together with provenance", async () => {
    const res = await request(build())
      .post("/api/analyses")
      .field("prompt", "Compare the documents")
      .attach("files", form, { filename: "form.txt", contentType: "text/plain" })
      .attach("files", licence, { filename: "licence.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("completed");
    expect(res.body.documents.map((d: { status: string }) => d.status)).toEqual(["processed", "processed"]);

    const discrepancy = res.body.result.findings.find(
      (f: { type: string; label: string }) => f.type === "discrepancy" && f.label.startsWith("Company"),
    );
    expect(discrepancy.kind).toBe("interpretation");
    const refs = discrepancy.sources.map((s: { filename: string; ref: string }) => `${s.filename}@${s.ref}`);
    expect(refs).toEqual(["form.txt@lines 1-3", "licence.pdf@page 1"]);
  });

  it("flags bad files per file but still analyses the good ones", async () => {
    const res = await request(build())
      .post("/api/analyses")
      .field("prompt", "Compare")
      .attach("files", form, { filename: "form.txt", contentType: "text/plain" })
      .attach("files", Buffer.from("MZ"), { filename: "tool.exe", contentType: "application/octet-stream" })
      .attach("files", Buffer.from("%PDF-1.4 garbage"), { filename: "broken.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    const byName = Object.fromEntries(res.body.documents.map((d: { filename: string; status: string }) => [d.filename, d.status]));
    expect(byName).toEqual({ "form.txt": "processed", "tool.exe": "unsupported", "broken.pdf": "unreadable" });
  });

  it("returns 422 with per-file reasons when nothing is readable", async () => {
    const res = await request(build())
      .post("/api/analyses")
      .field("prompt", "Compare")
      .attach("files", Buffer.from("MZ"), { filename: "tool.exe", contentType: "application/octet-stream" });
    expect(res.status).toBe(422);
    expect(res.body.documents[0].reason).toContain("Unsupported");
  });

  it("returns 502 with a safe message when the LLM fails", async () => {
    const failing: LLMProvider = {
      name: "failing",
      async extractFacts() {
        throw new LLMError("The LLM request failed (HTTP 500).");
      },
      async analyze() {
        throw new LLMError("unused");
      },
    };
    const res = await request(build(failing))
      .post("/api/analyses")
      .field("prompt", "Compare")
      .attach("files", form, { filename: "form.txt", contentType: "text/plain" });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("The LLM request failed (HTTP 500).");
  });

  it("validates the prompt and requires files", async () => {
    const app = build();
    const noPrompt = await request(app).post("/api/analyses").attach("files", form, "form.txt");
    expect(noPrompt.status).toBe(400);
    const noFiles = await request(app).post("/api/analyses").field("prompt", "x");
    expect(noFiles.status).toBe(400);
  });
});

describe("GET /api/analyses/:id", () => {
  it("returns a stored analysis, 404 for unknown ids and 400 for malformed ids", async () => {
    const app = build();
    const created = await request(app)
      .post("/api/analyses")
      .field("prompt", "Compare")
      .attach("files", form, { filename: "form.txt", contentType: "text/plain" });

    const found = await request(app).get(`/api/analyses/${created.body.id}`);
    expect(found.status).toBe(200);
    expect(found.body.id).toBe(created.body.id);

    expect((await request(app).get("/api/analyses/nope")).status).toBe(404);
    expect((await request(app).get("/api/analyses/bad!id")).status).toBe(400);
  });
});
