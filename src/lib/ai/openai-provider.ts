import OpenAI from "openai";
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

export { AiConfigurationError, AiServiceError };

export class OpenAiProvider implements AiProvider {
  readonly name = "OPENAI" as const;
  public readonly model: string;
  private client: OpenAI;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new AiConfigurationError(
        "OpenAI API key is not configured. Please set OPENAI_API_KEY in your server environment.",
      );
    }
    this.client = new OpenAI({ apiKey: key });
    this.model = model || process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
  }

  async extractVocabularyFromImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<ExtractedCandidate[]> {
    const base64Data = imageBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: VISION_EXTRACTION_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this English study material and extract all intentionally marked vocabulary words or short phrases.",
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl,
                  detail: "high",
                },
              },
            ],
          },
        ],
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AiServiceError("No response content received from AI.");
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch {
        throw new AiServiceError(
          "AI returned malformed JSON. Please try another image.",
        );
      }

      const validation = rawExtractionResponseSchema.safeParse(parsedJson);
      if (!validation.success) {
        throw new AiServiceError(
          "AI output did not match expected vocabulary schema.",
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
        if (
          error.message.includes("quota") ||
          error.message.includes("rate_limit")
        ) {
          throw new AiServiceError(
            "AI service limit reached. Please wait a moment and try again.",
          );
        }
        if (error.message.includes("API key")) {
          throw new AiConfigurationError(
            "Invalid OpenAI API key. Check your server settings.",
          );
        }
      }
      throw new AiServiceError(
        "Could not analyze image. Make sure the photo is clear and try again.",
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
      const response = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: ENRICHMENT_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(
              candidates.map((c) => ({
                id: c.id,
                word: c.word,
                context: c.context || "",
              })),
            ),
          },
        ],
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AiServiceError("No enrichment response received from AI.");
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch {
        throw new AiServiceError("AI returned malformed enrichment data.");
      }

      const validation = rawEnrichmentResponseSchema.safeParse(parsedJson);
      if (!validation.success) {
        throw new AiServiceError("Invalid enrichment data structure.");
      }

      // Map back to candidates, preserving IDs
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
      throw new AiServiceError(
        "Could not enrich vocabulary. Please verify selections and retry.",
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
      throw new AiServiceError("Could not generate vocabulary details.");
    }
    return results[0];
  }
}
