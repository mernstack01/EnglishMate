import { GoogleGenAI } from "@google/genai";
import {
  rawExtractionResponseSchema,
  rawEnrichmentResponseSchema,
} from "@/validations/ai";
import {
  VISION_EXTRACTION_SYSTEM_PROMPT,
  ENRICHMENT_SYSTEM_PROMPT,
} from "./prompts";
import {
  type AiProvider,
  type CandidateToEnrich,
  type EnrichedVocabulary,
  type ExtractedCandidate,
  AiConfigurationError,
  AiServiceError,
} from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export class GeminiProvider implements AiProvider {
  readonly name = "GEMINI" as const;
  public readonly model: string;
  private client: GoogleGenAI;

  constructor(apiKey?: string, model?: string, client?: GoogleGenAI) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key && !client) {
      throw new AiConfigurationError(
        "Gemini API key is not configured. Please set GEMINI_API_KEY in your server environment.",
      );
    }
    this.model = model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    this.client = client || new GoogleGenAI({ apiKey: key });
  }

  async extractVocabularyFromImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<ExtractedCandidate[]> {
    const base64Data = imageBuffer.toString("base64");

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: "Analyze this English study material and extract all intentionally marked vocabulary words or short phrases.",
              },
            ],
          },
        ],
        config: {
          systemInstruction: VISION_EXTRACTION_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const content = response.text;
      if (!content) {
        throw new AiServiceError("No response content received from Gemini.");
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch {
        throw new AiServiceError(
          "Gemini returned malformed JSON. Please try another image.",
        );
      }

      const validation = rawExtractionResponseSchema.safeParse(parsedJson);
      if (!validation.success) {
        throw new AiServiceError(
          "Gemini output did not match expected vocabulary schema.",
        );
      }

      return validation.data.candidates.map((c, index) => ({
        id: `cand_${Date.now()}_${index}`,
        word: c.word,
        confidence: c.confidence,
        markingType: c.markingType,
        context: c.context,
      }));
    } catch (error: unknown) {
      if (
        error instanceof AiConfigurationError ||
        error instanceof AiServiceError
      ) {
        throw error;
      }
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
          message.includes("api_key") ||
          message.includes("api key") ||
          message.includes("unauthenticated")
        ) {
          throw new AiConfigurationError(
            "Invalid Gemini API key. Check your server settings.",
          );
        }
        if (
          message.includes("quota") ||
          message.includes("resource_exhausted") ||
          message.includes("rate_limit") ||
          message.includes("429")
        ) {
          throw new AiServiceError(
            "Gemini service rate limit or quota reached. Please wait a moment and try again.",
          );
        }
      }
      throw new AiServiceError(
        "Could not analyze image with Gemini. Make sure the photo is clear and try again.",
      );
    }
  }

  async enrichVocabulary(
    candidates: CandidateToEnrich[],
  ): Promise<EnrichedVocabulary[]> {
    if (!candidates.length) return [];

    const CHUNK_SIZE = 12;
    if (candidates.length > CHUNK_SIZE) {
      const results: EnrichedVocabulary[] = [];
      for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
        const chunk = candidates.slice(i, i + CHUNK_SIZE);
        const enrichedChunk = await this.enrichVocabularyChunk(chunk);
        results.push(...enrichedChunk);
      }
      return results;
    }
    return this.enrichVocabularyChunk(candidates);
  }

  private async enrichVocabularyChunk(
    candidates: CandidateToEnrich[],
  ): Promise<EnrichedVocabulary[]> {
    if (!candidates.length) return [];

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: JSON.stringify(
                  candidates.map((c) => ({
                    id: c.id,
                    word: c.word,
                    context: c.context || "",
                  })),
                ),
              },
            ],
          },
        ],
        config: {
          systemInstruction: ENRICHMENT_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      });

      const content = response.text;
      if (!content) {
        throw new AiServiceError(
          "No enrichment response received from Gemini.",
        );
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch {
        throw new AiServiceError("Gemini returned malformed enrichment data.");
      }

      const validation = rawEnrichmentResponseSchema.safeParse(parsedJson);
      if (!validation.success) {
        throw new AiServiceError(
          "Invalid enrichment data structure from Gemini.",
        );
      }

      return candidates.map((candidate, idx) => {
        const enriched =
          validation.data.items.find((item) => item.id === candidate.id) ||
          validation.data.items[idx];

        return {
          id: candidate.id,
          word: candidate.word,
          translation: enriched?.translation || "",
          definition: enriched?.definition || "",
          example: enriched?.example || candidate.context || "",
          partOfSpeech: enriched?.partOfSpeech || "word",
          pronunciation: enriched?.pronunciation || "",
          synonyms: enriched?.synonyms || [],
        };
      });
    } catch (error: unknown) {
      if (
        error instanceof AiConfigurationError ||
        error instanceof AiServiceError
      ) {
        throw error;
      }
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
          message.includes("api_key") ||
          message.includes("api key") ||
          message.includes("unauthenticated")
        ) {
          throw new AiConfigurationError(
            "Invalid Gemini API key. Check your server settings.",
          );
        }
        if (
          message.includes("quota") ||
          message.includes("resource_exhausted") ||
          message.includes("429")
        ) {
          throw new AiServiceError(
            "Gemini rate limit or quota reached. Please wait a moment and try again.",
          );
        }
      }
      throw new AiServiceError(
        "Could not enrich vocabulary with Gemini. Please verify selections and retry.",
      );
    }
  }

  async enrichSingleWord(
    word: string,
    context?: string,
  ): Promise<EnrichedVocabulary> {
    const results = await this.enrichVocabulary([
      { id: "single_word", word, context },
    ]);
    if (!results[0]) {
      throw new AiServiceError(
        "Could not generate vocabulary details with Gemini.",
      );
    }
    return results[0];
  }
}
