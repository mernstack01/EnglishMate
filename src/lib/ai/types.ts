export const markingTypes = [
  "HIGHLIGHTED",
  "UNDERLINED",
  "CIRCLED",
  "BOXED",
  "VOCABULARY_LIST",
  "PEN_MARK",
  "OTHER",
] as const;

export type MarkingType = (typeof markingTypes)[number];

export interface ExtractedCandidate {
  id: string;
  word: string;
  confidence: number;
  markingType: MarkingType;
  context: string;
}

export interface CandidateToEnrich {
  id: string;
  word: string;
  context?: string;
}

export interface EnrichedVocabulary {
  id: string;
  word: string;
  translation: string;
  definition: string;
  example: string;
  partOfSpeech: string;
  pronunciation: string;
  synonyms: string[];
  isDuplicate?: boolean;
  duplicateReason?: string;
}

export type SupportedAiProviderName = "OPENAI" | "GEMINI" | "MOCK";

export interface AiProvider {
  readonly name?: SupportedAiProviderName;
  readonly model?: string;
  extractVocabularyFromImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<ExtractedCandidate[]>;
  enrichVocabulary(
    candidates: CandidateToEnrich[],
  ): Promise<EnrichedVocabulary[]>;
  enrichSingleWord(word: string, context?: string): Promise<EnrichedVocabulary>;
}

export class AiConfigurationError extends Error {
  constructor(message = "AI service configuration is missing or invalid.") {
    super(message);
    this.name = "AiConfigurationError";
  }
}

export class AiServiceError extends Error {
  constructor(message = "AI service request failed. Please try again.") {
    super(message);
    this.name = "AiServiceError";
  }
}
