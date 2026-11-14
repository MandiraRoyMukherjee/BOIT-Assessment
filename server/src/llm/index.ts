import { config } from "../config.js";
import { MockProvider } from "./mockProvider.js";
import { OpenAIProvider } from "./openaiProvider.js";
import type { LLMProvider } from "./types.js";

export { LLMError } from "./types.js";
export type { LLMProvider } from "./types.js";

/** Chooses the provider from LLM_PROVIDER. Fails fast when the selected provider is misconfigured. */
export function createProvider(): LLMProvider {
  if (config.LLM_PROVIDER === "openai") {
    if (!config.LLM_API_KEY) {
      throw new Error("LLM_PROVIDER=openai requires LLM_API_KEY to be set");
    }
    return new OpenAIProvider({
      apiKey: config.LLM_API_KEY,
      model: config.LLM_MODEL,
      baseUrl: config.LLM_BASE_URL,
      timeoutMs: config.LLM_TIMEOUT_MS,
    });
  }
  return new MockProvider();
}
