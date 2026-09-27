import { MockAiProvider } from "./mock-provider";
import { OpenAiProvider } from "./openai-provider";
import { GeminiProvider } from "./gemini-provider";
import { type AiProvider, AiConfigurationError } from "./types";

let globalCustomProvider: AiProvider | null = null;

export function setCustomAiProvider(provider: AiProvider | null) {
  globalCustomProvider = provider;
}

export function getAiProvider(): AiProvider {
  if (globalCustomProvider) {
    return globalCustomProvider;
  }

  // Use mock provider during tests or if explicitly requested in environment
  if (
    process.env.AI_PROVIDER === "mock" ||
    process.env.NODE_ENV === "test" ||
    process.env.PLAYWRIGHT_TEST === "1"
  ) {
    return new MockAiProvider();
  }

  const requestedProvider = (process.env.AI_PROVIDER || "")
    .toLowerCase()
    .trim();

  // If Gemini is explicitly configured
  if (requestedProvider === "gemini") {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new AiConfigurationError(
        "Gemini API key is not configured. Please set GEMINI_API_KEY in your environment.",
      );
    }
    return new GeminiProvider(geminiKey);
  }

  // If OpenAI is explicitly configured
  if (requestedProvider === "openai") {
    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      throw new AiConfigurationError(
        "OpenAI API key is not configured. Please set OPENAI_API_KEY in your environment.",
      );
    }
    return new OpenAiProvider(openAiKey);
  }

  // If AI_PROVIDER is not explicitly specified, auto-detect available credentials
  if (process.env.GEMINI_API_KEY) {
    return new GeminiProvider(process.env.GEMINI_API_KEY);
  }

  if (process.env.OPENAI_API_KEY) {
    return new OpenAiProvider(process.env.OPENAI_API_KEY);
  }

  // Neither key is configured
  throw new AiConfigurationError(
    "AI provider is not configured. Please set GEMINI_API_KEY (or OPENAI_API_KEY) in your environment.",
  );
}

export { AiConfigurationError, AiServiceError } from "./types";
export { MockAiProvider } from "./mock-provider";
export { OpenAiProvider } from "./openai-provider";
export { GeminiProvider, DEFAULT_GEMINI_MODEL } from "./gemini-provider";
export type * from "./types";
