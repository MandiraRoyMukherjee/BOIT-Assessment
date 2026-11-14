import { afterEach, describe, expect, it, vi } from "vitest";

describe("fractional upload limits", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("loads the router when MAX_FILE_MB is fractional (as configured on Vercel)", async () => {
    vi.stubEnv("MAX_FILE_MB", "0.8");
    vi.resetModules();
    const { createAnalysesRouter } = await import("./analyses.js");
    const { MemoryAnalysisRepository } = await import("../repository/memoryRepository.js");
    const { MockProvider } = await import("../llm/mockProvider.js");
    expect(() => createAnalysesRouter({ repo: new MemoryAnalysisRepository(), provider: new MockProvider() })).not.toThrow();
  });
});
