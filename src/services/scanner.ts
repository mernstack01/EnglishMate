import "server-only";
import { connectDB } from "@/lib/db/connect";
import { ownedScope } from "@/lib/db/ownership";
import { VocabularyWord } from "@/models/vocabulary-word";
import { ensureUserReviews } from "@/services/vocabulary";
import { normalizeWord } from "@/features/vocabulary/constants";
import { importScannedWordsSchema } from "@/validations/scanner";
import type { ImportScannedWordsResult } from "@/features/scanner/types";
import { mongo } from "mongoose";

export class ScannerServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScannerServiceError";
  }
}

/**
 * Imports confirmed scanned words into the user's Vocabulary notebook.
 * Strictly uses authenticated session ownership (ownedScope) and prevents client userId forgery.
 * Applies unique index deduplication against existing vocabulary entries.
 */
export async function importScannedWords(
  input: unknown,
): Promise<ImportScannedWordsResult> {
  const owner = await ownedScope();
  await connectDB();

  const parsed = importScannedWordsSchema.parse(input);
  const wordsToProcess = parsed.words;

  // Deduplicate within the input payload itself
  const uniqueItemsMap = new Map<
    string,
    { word: string; translation: string; notes: string; normalized: string }
  >();
  let internalDuplicates = 0;

  for (const item of wordsToProcess) {
    const normalized = normalizeWord(item.word);
    if (!normalized) continue;

    if (uniqueItemsMap.has(normalized)) {
      internalDuplicates++;
    } else {
      uniqueItemsMap.set(normalized, {
        word: item.word,
        translation: item.translation.trim() || "—",
        notes: item.notes.trim() || "Imported from textbook scan",
        normalized,
      });
    }
  }

  const uniqueCandidates = Array.from(uniqueItemsMap.values());
  const normalizedList = uniqueCandidates.map((c) => c.normalized);

  // Check which words already exist in the user's notebook
  const existingDocs = await VocabularyWord.find({
    userId: owner.userId,
    normalizedWord: { $in: normalizedList },
  })
    .select("normalizedWord")
    .lean();

  const existingSet = new Set(existingDocs.map((doc) => doc.normalizedWord));
  const readyToInsert = uniqueCandidates.filter(
    (item) => !existingSet.has(item.normalized),
  );

  let skippedDuplicatesCount =
    internalDuplicates + (uniqueCandidates.length - readyToInsert.length);

  if (readyToInsert.length === 0) {
    return {
      importedCount: 0,
      skippedDuplicatesCount,
      importedWords: [],
    };
  }

  const operations = readyToInsert.map((item) => {
    const doc = new VocabularyWord({
      userId: owner.userId,
      word: item.word,
      normalizedWord: item.normalized,
      translation: item.translation,
      notes: item.notes,
      source: "IMAGE",
      status: "NEW",
      difficulty: 0,
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

    // Fetch newly created documents to return IDs and words
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
    // If concurrent insert occurred, treat 11000 duplicate write errors as skipped
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

  // Ensure reviews are initialized in the spaced repetition system
  if (importedCount > 0) {
    await ensureUserReviews(owner.userId);
  }

  return {
    importedCount,
    skippedDuplicatesCount,
    importedWords,
  };
}
