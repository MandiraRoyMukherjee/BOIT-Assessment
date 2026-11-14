import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { MockProvider } from "../llm/mockProvider.js";
import { MemoryAnalysisRepository } from "../repository/memoryRepository.js";

const build = () => createApp({ repo: new MemoryAnalysisRepository(), provider: new MockProvider() });

describe("error handling", () => {
  it("returns JSON 404 for unknown routes", async () => {
    const res = await request(build()).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("returns 400 for malformed JSON bodies without leaking details", async () => {
    const res = await request(build()).post("/api/health").set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Malformed request body" });
  });

  it("sends security headers and hides the framework", async () => {
    const res = await request(build()).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("rate limits repeated analysis requests", async () => {
    const app = build();
    const file = Buffer.from("Company: Acme");
    let limited = 0;
    for (let i = 0; i < 12; i++) {
      const res = await request(app)
        .post("/api/analyses")
        .field("prompt", "x")
        .attach("files", file, { filename: "a.txt", contentType: "text/plain" });
      if (res.status === 429) limited++;
    }
    expect(limited).toBe(2);
  });
});
