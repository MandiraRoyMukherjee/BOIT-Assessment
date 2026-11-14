import { z } from "zod";
import { buildAnalyzePrompt, buildExtractPrompt, type PromptPair } from "./prompts.js";
import {
  analysisSchema,
  extractionSchema,
  LLMError,
  type AnalyzeInput,
  type ExtractInput,
  type LLMProvider,
  type RawAnalysis,
  type RawExtraction,
} from "./types.js";

export interface OpenAIOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  choices?: { message?: { content?: string | null } }[];
}

/** Provider for any OpenAI-compatible /chat/completions endpoint, using JSON mode. */
export class OpenAIProvider implements LLMProvider {
  readonly name: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenAIOptions) {
    this.name = `openai:${options.model}`;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  extractFacts(input: ExtractInput): Promise<RawExtraction> {
    return this.completeJson(extractionSchema, buildExtractPrompt(input));
  }

  analyze(input: AnalyzeInput): Promise<RawAnalysis> {
    return this.completeJson(analysisSchema, buildAnalyzePrompt(input));
  }

  /** Calls the model and validates the JSON against the schema; retries once with the validation error. */
  private async completeJson<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, prompt: PromptPair): Promise<T> {
    const messages: ChatMessage[] = [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ];

    for (let attempt = 0; attempt < 2; attempt++) {
      const content = await this.chat(messages);
      try {
        return schema.parse(JSON.parse(content));
      } catch (err) {
        if (attempt === 1) {
          throw new LLMError("The model returned output that did not match the required structure.");
        }
        const reason = err instanceof z.ZodError ? err.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : "not valid JSON";
        messages.push(
          { role: "assistant", content },
          { role: "user", content: `That reply was invalid (${reason}). Reply again with ONLY valid JSON matching the schema.` },
        );
      }
    }
    throw new LLMError("The model did not return usable output.");
  }

  private async chat(messages: ChatMessage[]): Promise<string> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.options.apiKey}` },
        body: JSON.stringify({
          model: this.options.model,
          messages,
          temperature: 0,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (err) {
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new LLMError(`The LLM request timed out after ${this.options.timeoutMs}ms.`);
      }
      throw new LLMError("The LLM request failed (network error).");
    }

    if (!response.ok) {
      throw new LLMError(`The LLM request failed (HTTP ${response.status}).`);
    }
    const data = (await response.json()) as ChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new LLMError("The LLM returned an empty response.");
    return content;
  }
}
