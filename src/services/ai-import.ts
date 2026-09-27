import "server-only";
import { connectDB } from "@/lib/db/connect";
import { ownedScope } from "@/lib/db/ownership";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { getAiProvider } from "@/lib/ai/provider";
import { AiUsage } from "@/models/ai-usage";
import { VocabularyWord } from "@/models/vocabulary-word";
import { ensureUserReviews } from "@/services/vocabulary";
import { normalizeWord } from "@/features/vocabulary/constants";
import {
  MAX_IMAGE_BYTES,
  enrichSelectionSchema,
  confirmImageImportSchema,
} from "@/validations/ai";
import type {
  ExtractedCandidate,
  CandidateToEnrich,
  EnrichedVocabulary,
} from "@/lib/ai/types";
import { mongo } from "mongoose";

export class AiImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiImportError";
  }
}

import { detectImageMimeType } from "@/lib/ai/image-utils";

export { detectImageMimeType };

/**
 * Analyzes textbook image and returns intentionally marked candidates.
 */
export async function analyzeTextbookImage(
  buffer: Buffer,
): Promise<{ candidates: ExtractedCandidate[] }> {
  const owner = await ownedScope();
  await connectDB();

  // Validate size
  if (!buffer || buffer.length === 0) {
    throw new AiImportError("Please select an image file to analyze.");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new AiImportError(
      `Image size exceeds maximum limit of ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`,
    );
  }

  // Server-side magic-bytes validation
  const detectedMime = detectImageMimeType(buffer);
  if (!detectedMime) {
    throw new AiImportError(
      "Unsupported file format. Please upload a valid JPG, PNG, or WEBP image.",
    );
  }

  // Check rate limit: 20 image analyses per 15 minutes per user
  const allowed = await consumeRateLimit(
    `ai:image:${owner.userId}`,
    20,
    15 * 60 * 1000,
  );
  if (!allowed) {
    throw new AiImportError(
      "Image analysis rate limit reached. Please wait a few minutes before analyzing another image.",
    );
  }

  const provider = getAiProvider();
  const providerName = provider.name || "OPENAI";
  const modelName =
    provider.model ||
    (providerName === "GEMINI"
      ? process.env.GEMINI_MODEL || "gemini-2.5-flash"
      : process.env.OPENAI_VISION_MODEL || "gpt-4o-mini");
  let candidates: ExtractedCandidate[] = [];

  try {
    candidates = await provider.extractVocabularyFromImage(
      buffer,
      detectedMime,
    );
  } catch (error: unknown) {
    await AiUsage.create({
      userId: owner.userId,
      operation: "IMAGE_EXTRACTION",
      provider: providerName,
      model: modelName,
      success: false,
      itemCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }).catch(() => {});

    if (error instanceof Error) {
      throw new AiImportError(error.message);
    }
    throw new AiImportError(
      "Failed to analyze image. Please try again with a clearer photo.",
    );
  }

  await AiUsage.create({
    userId: owner.userId,
    operation: "IMAGE_EXTRACTION",
    provider: providerName,
    model: modelName,
    success: true,
    itemCount: candidates.length,
  }).catch(() => {});

  return { candidates };
}

/**
 * Enriches user-selected vocabulary candidates with Uzbek translations, simple definitions, and examples.
 * Also performs duplicate detection against the user's existing vocabulary.
 */
export async function enrichSelectedCandidates(
  rawCandidates: CandidateToEnrich[],
): Promise<{ items: EnrichedVocabulary[] }> {
  const owner = await ownedScope();
  await connectDB();

  const validated = enrichSelectionSchema.parse({ candidates: rawCandidates });

  // Rate limit: 60 enrichments per 15 minutes per user
  const allowed = await consumeRateLimit(
    `ai:enrich:${owner.userId}`,
    60,
    15 * 60 * 1000,
  );
  if (!allowed) {
    throw new AiImportError(
      "Enrichment rate limit reached. Please wait a few minutes before preparing vocabulary.",
    );
  }

  const provider = getAiProvider();
  const providerName = provider.name || "OPENAI";
  const modelName =
    provider.model ||
    (providerName === "GEMINI"
      ? process.env.GEMINI_MODEL || "gemini-2.5-flash"
      : process.env.OPENAI_VISION_MODEL || "gpt-4o-mini");
  let enriched: EnrichedVocabulary[] = [];

  try {
    enriched = await provider.enrichVocabulary(validated.candidates);
  } catch (error: unknown) {
    await AiUsage.create({
      userId: owner.userId,
      operation: "VOCABULARY_ENRICHMENT",
      provider: providerName,
      model: modelName,
      success: false,
      itemCount: validated.candidates.length,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }).catch(() => {});

    if (error instanceof Error) {
      throw new AiImportError(error.message);
    }
    throw new AiImportError("Failed to enrich vocabulary items. Please retry.");
  }

  // Duplicate check against user's vocabulary
  const normalizedList = enriched.map((item) => normalizeWord(item.word));
  const existingWords = await VocabularyWord.find({
    userId: owner.userId,
    normalizedWord: { $in: normalizedList },
  })
    .select("normalizedWord word")
    .lean();

  const existingSet = new Set(existingWords.map((w) => w.normalizedWord));

  const itemsWithDuplicates: EnrichedVocabulary[] = enriched.map((item) => {
    const isDup = existingSet.has(normalizeWord(item.word));
    return {
      ...item,
      isDuplicate: isDup,
      duplicateReason: isDup ? "Already in your vocabulary" : undefined,
    };
  });

  await AiUsage.create({
    userId: owner.userId,
    operation: "VOCABULARY_ENRICHMENT",
    provider: providerName,
    model: modelName,
    success: true,
    itemCount: itemsWithDuplicates.length,
  }).catch(() => {});

  return { items: itemsWithDuplicates };
}

/**
 * Autocompletes learning metadata for a single word in manual creation or editing.
 */
export async function autofillWord(
  word: string,
  context?: string,
): Promise<EnrichedVocabulary> {
  const owner = await ownedScope();
  await connectDB();

  const trimmed = word?.trim();
  if (!trimmed || trimmed.length > 120) {
    throw new AiImportError(
      "Please provide a valid word up to 120 characters.",
    );
  }

  const allowed = await consumeRateLimit(
    `ai:autofill:${owner.userId}`,
    60,
    15 * 60 * 1000,
  );
  if (!allowed) {
    throw new AiImportError(
      "AI autofill rate limit reached. Please wait a few minutes.",
    );
  }

  const provider = getAiProvider();
  const providerName = provider.name || "OPENAI";
  const modelName =
    provider.model ||
    (providerName === "GEMINI"
      ? process.env.GEMINI_MODEL || "gemini-2.5-flash"
      : process.env.OPENAI_VISION_MODEL || "gpt-4o-mini");
  let result: EnrichedVocabulary;

  try {
    result = await provider.enrichSingleWord(trimmed, context);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new AiImportError(error.message);
    }
    throw new AiImportError(
      "Could not retrieve AI suggestions. Please try again.",
    );
  }

  // Check if already in notebook
  const existing = await VocabularyWord.findOne({
    userId: owner.userId,
    normalizedWord: normalizeWord(trimmed),
  })
    .select("_id")
    .lean();

  if (existing) {
    result.isDuplicate = true;
    result.duplicateReason = "This word is already in your notebook.";
  }

  await AiUsage.create({
    userId: owner.userId,
    operation: "SINGLE_AUTOFILL",
    provider: providerName,
    model: modelName,
    success: true,
    itemCount: 1,
  }).catch(() => {});

  return result;
}

/**
 * Confirms and persists final selected vocabulary into the user's notebook.
 * Saves words with source: "IMAGE", status: "NEW", and initializes spaced repetition review records.
 */
export async function confirmImageImport(rawWords: unknown): Promise<{
  importedCount: number;
  skippedDuplicatesCount: number;
  importedWords: Array<{ id: string; word: string; translation: string }>;
}> {
  const owner = await ownedScope();
  await connectDB();

  const validated = confirmImageImportSchema.parse(rawWords);
  const words = validated.words;

  // Final server-side duplicate check: Never trust client duplicate flags alone
  const normalizedWords = words.map((w) => ({
    ...w,
    normalized: normalizeWord(w.word),
  }));

  const normalizedKeys = normalizedWords.map((w) => w.normalized);
  const existingRecords = await VocabularyWord.find({
    userId: owner.userId,
    normalizedWord: { $in: normalizedKeys },
  })
    .select("normalizedWord")
    .lean();

  const existingNormalizedSet = new Set(
    existingRecords.map((r) => r.normalizedWord),
  );

  // Also deduplicate within the current import payload itself
  const seenInBatch = new Set<string>();
  const readyToInsert: typeof normalizedWords = [];
  let skippedDuplicatesCount = 0;

  for (const item of normalizedWords) {
    if (
      existingNormalizedSet.has(item.normalized) ||
      seenInBatch.has(item.normalized)
    ) {
      skippedDuplicatesCount++;
    } else {
      seenInBatch.add(item.normalized);
      readyToInsert.push(item);
    }
  }

  if (readyToInsert.length === 0) {
    return {
      importedCount: 0,
      skippedDuplicatesCount,
      importedWords: [],
    };
  }

  const operations = readyToInsert.map((item) => {
    // If synonyms exist, append to notes for Phase 4 (Phase 5 will introduce Synonym Notebook)
    let notes = "";
    if (item.synonyms && item.synonyms.length > 0) {
      notes = `Synonyms: ${item.synonyms.join(", ")}`;
    }

    const doc = new VocabularyWord({
      userId: owner.userId,
      word: item.word,
      normalizedWord: item.normalized,
      translation: item.translation,
      definition: item.definition || "",
      example: item.example || "",
      pronunciation: item.pronunciation || "",
      partOfSpeech: item.partOfSpeech || "",
      notes,
      source: "IMAGE",
      status: "NEW",
    });

    const value = doc.toObject();
    return {
      updateOne: {
        filter: { userId: owner.userId, normalizedWord: item.normalized },
        update: {
          $setOnInsert: {
            ...value,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        upsert: true,
        timestamps: false,
      },
    };
  });

  let importedCount = 0;
  const importedWords: Array<{
    id: string;
    word: string;
    translation: string;
  }> = [];

  try {
    const result = await VocabularyWord.bulkWrite(operations, {
      ordered: false,
    });
    importedCount = result.upsertedCount;

    // Retrieve inserted records to return details
    const insertedNormalized = Object.keys(result.upsertedIds).map(
      (idx) => readyToInsert[Number(idx)].normalized,
    );

    const insertedDocs = await VocabularyWord.find({
      userId: owner.userId,
      normalizedWord: { $in: insertedNormalized },
    })
      .select("_id word translation")
      .lean();

    for (const doc of insertedDocs) {
      importedWords.push({
        id: doc._id.toString(),
        word: doc.word,
        translation: doc.translation,
      });
    }
  } catch (error) {
    if (
      error instanceof mongo.MongoBulkWriteError &&
      Array.isArray(error.writeErrors) &&
      error.writeErrors.every((e) => e.code === 11000)
    ) {
      importedCount = error.result.upsertedCount;
      skippedDuplicatesCount += readyToInsert.length - importedCount;
    } else {
      throw error;
    }
  }

  // Ensure reviews are initialized immediately for all imported words
  if (importedCount > 0) {
    await ensureUserReviews(owner.userId);
  }

  return {
    importedCount,
    skippedDuplicatesCount,
    importedWords,
  };
}
