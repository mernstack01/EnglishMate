import "server-only";
import {
  VocabularyWord,
  type VocabularyRecord,
} from "@/models/vocabulary-word";
import { VocabularyReview } from "@/models/vocabulary-review";
import { connectDB } from "@/lib/db/connect";
import { ownedScope, ownedDocumentScope } from "@/lib/db/ownership";
import { vocabularyTimezone } from "@/lib/vocabulary-timezone";
import { dateKey, dayRange, monthKeys, startOfDay } from "@/lib/dates";
import {
  wordInputSchema,
  editWordSchema,
  wordIdSchema,
  statusInputSchema,
  vocabularyQuerySchema,
  parseImport,
  monthSchema,
} from "@/validations/vocabulary";
import { normalizeWord } from "@/features/vocabulary/constants";
import type {
  VocabularyDTO,
  ImportPreview,
  ImportResult,
  ImportRow,
} from "@/types/vocabulary";
import { mongo, type Types, type SortOrder } from "mongoose";
export class VocabularyError extends Error {}
const missing = () => new VocabularyError("Word not found.");
const duplicateError = () =>
  new VocabularyError("This word is already in your notebook.");
function isDuplicate(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === 11000
  );
}
function dto(
  word: VocabularyRecord & { _id: Types.ObjectId },
  timezone: string,
): VocabularyDTO {
  return {
    id: word._id.toString(),
    word: word.word,
    translation: word.translation,
    definition: word.definition,
    example: word.example,
    pronunciation: word.pronunciation,
    partOfSpeech: word.partOfSpeech,
    notes: word.notes,
    status: word.status,
    difficulty: word.difficulty,
    source: word.source,
    createdAt: word.createdAt.toISOString(),
    updatedAt: word.updatedAt.toISOString(),
    date: dateKey(word.createdAt, timezone),
  };
}
async function scope() {
  const owner = await ownedScope();
  await connectDB();
  return owner;
}
async function documentScope(id: unknown) {
  await ownedScope(); // Authentication precedes even malformed-ID responses.
  if (!wordIdSchema.safeParse(id).success) throw missing();
  const owner = await ownedDocumentScope(id as string);
  await connectDB();
  return owner;
}
export async function createVocabulary(input: unknown) {
  const owner = await scope();
  const data = wordInputSchema.parse(input);
  try {
    const word = await VocabularyWord.create({
      ...data,
      ...owner,
      normalizedWord: normalizeWord(data.word),
      status: "NEW",
      source: "MANUAL",
    });
    await VocabularyReview.create({
      userId: owner.userId,
      vocabularyWordId: word._id,
      nextReviewAt: word.review.nextReviewAt,
    }).catch(() => {});
    return word._id.toString();
  } catch (error) {
    if (isDuplicate(error)) throw duplicateError();
    throw error;
  }
}
export async function getVocabulary(id: unknown) {
  const owner = await documentScope(id);
  const word = await VocabularyWord.findOne(owner).lean();
  if (!word) throw missing();
  return dto(word, vocabularyTimezone());
}
export async function updateVocabulary(id: unknown, input: unknown) {
  const owner = await documentScope(id);
  // A missing/foreign target is resolved before duplicate checks: no existence oracle.
  if (!(await VocabularyWord.exists(owner))) throw missing();
  const data = editWordSchema.parse(input);
  try {
    const result = await VocabularyWord.updateOne(
      owner,
      { $set: { ...data, normalizedWord: normalizeWord(data.word) } },
      { runValidators: true },
    );
    if (!result.matchedCount) throw missing();
  } catch (error) {
    if (isDuplicate(error)) throw duplicateError();
    throw error;
  }
}
export async function changeVocabularyStatus(input: unknown) {
  await ownedScope();
  const data = statusInputSchema.parse(input);
  const owner = await documentScope(data.id);
  const result = await VocabularyWord.updateOne(
    owner,
    { $set: { status: data.status } },
    { runValidators: true },
  );
  if (!result.matchedCount) throw missing();
}
export async function deleteVocabulary(id: unknown) {
  const owner = await documentScope(id);
  const result = await VocabularyWord.deleteOne(owner);
  if (!result.deletedCount) throw missing();
  // Review is embedded in VocabularyWord: a single atomic deletion removes it with the word.
  // We also ensure cleanup on any matching VocabularyReview records so data is never orphaned.
  await VocabularyReview.deleteMany({
    userId: owner.userId,
    vocabularyWordId: owner._id,
  }).catch(() => {});
}
export async function listVocabulary(input: unknown) {
  const owner = await scope();
  const query = vocabularyQuerySchema.parse(input);
  const timezone = vocabularyTimezone();
  const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = {
    ...owner,
    ...(query.status !== "ALL" ? { status: query.status } : {}),
    ...(query.date ? { createdAt: dayRange(query.date, timezone) } : {}),
    ...(escaped
      ? {
          $or: [
            { word: { $regex: escaped, $options: "i" } },
            { translation: { $regex: escaped, $options: "i" } },
          ],
        }
      : {}),
  };
  const total = await VocabularyWord.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(query.page, pages);
  const sorts: Record<string, Record<string, SortOrder>> = {
    newest: { createdAt: -1, _id: -1 },
    oldest: { createdAt: 1, _id: 1 },
    az: { normalizedWord: 1, _id: 1 },
    za: { normalizedWord: -1, _id: -1 },
  };
  const words = await VocabularyWord.find(filter)
    .sort(sorts[query.sort])
    .skip((page - 1) * 20)
    .limit(20)
    .lean();
  return {
    words: words.map((w) => dto(w, timezone)),
    total,
    page,
    pages,
    timezone,
    today: dateKey(new Date(), timezone),
    query,
  };
}
export async function vocabularyCalendar(month: string) {
  const owner = await scope();
  monthSchema.parse(month);
  const timezone = vocabularyTimezone();
  const keys = monthKeys(month);
  const counts = await VocabularyWord.aggregate<{ _id: string; count: number }>(
    [
      {
        $match: {
          ...owner,
          createdAt: {
            $gte: startOfDay(keys.first, timezone),
            $lt: startOfDay(keys.next, timezone),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone },
          },
          count: { $sum: 1 },
        },
      },
    ],
  );
  return {
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    timezone,
    ...keys,
  };
}
export async function ensureUserReviews(userId: Types.ObjectId) {
  const words = await VocabularyWord.find({ userId })
    .select("_id review createdAt")
    .lean();
  if (!words.length) return;
  const existingReviews = await VocabularyReview.find({ userId })
    .select("vocabularyWordId")
    .lean();
  const reviewedWordIds = new Set(
    existingReviews.map((r) => r.vocabularyWordId.toString()),
  );
  const missing = words.filter((w) => !reviewedWordIds.has(w._id.toString()));
  if (!missing.length) return;
  const docs = missing.map((w) => ({
    userId,
    vocabularyWordId: w._id,
    nextReviewAt: w.review?.nextReviewAt || new Date(),
    lastReviewedAt: w.review?.lastReviewedAt || null,
    intervalDays: w.review?.intervalDays || 0,
    easeFactor: w.review?.easeFactor || 2.5,
    repetitions: w.review?.repetitions || 0,
    correctCount: w.review?.correctCount || 0,
    incorrectCount: w.review?.incorrectCount || 0,
    lastRating: null,
    createdAt: w.createdAt || new Date(),
  }));
  await VocabularyReview.insertMany(docs, { ordered: false }).catch(() => {});
}

export async function vocabularyStats() {
  const owner = await scope();
  await ensureUserReviews(owner.userId);
  const today = dayRange(
    dateKey(new Date(), vocabularyTimezone()),
    vocabularyTimezone(),
  );
  const learnedWordIds = await VocabularyWord.find({
    ...owner,
    status: "LEARNED",
  }).distinct("_id");

  const [total, newToday, difficult, due, learned] = await Promise.all([
    VocabularyWord.countDocuments(owner),
    VocabularyWord.countDocuments({ ...owner, createdAt: today }),
    VocabularyWord.countDocuments({ ...owner, status: "DIFFICULT" }),
    VocabularyReview.countDocuments({
      userId: owner.userId,
      vocabularyWordId: { $nin: learnedWordIds },
      nextReviewAt: { $lte: new Date() },
    }),
    VocabularyWord.countDocuments({ ...owner, status: "LEARNED" }),
  ]);
  return { total, newToday, difficult, due, learned };
}
async function analyzeImport(text: string) {
  const owner = await scope();
  const parsed = parseImport(text);
  const normalized = parsed.flatMap((row) =>
    row.kind === "ready" ? [row.normalized] : [],
  );
  const existing = await VocabularyWord.find({
    ...owner,
    normalizedWord: { $in: normalized },
  })
    .select("normalizedWord")
    .lean();
  const found = new Set(existing.map((w) => w.normalizedWord));
  const rows = parsed.map((row) =>
    row.kind === "ready" && found.has(row.normalized)
      ? {
          ...row,
          kind: "existing" as const,
          issues: "Already in your notebook; will be skipped.",
        }
      : row,
  );
  return { owner, rows };
}
const previewRow = (row: ImportRow): ImportRow => ({
  row: row.row,
  word: row.word,
  translation: row.translation,
  kind: row.kind,
  issues: row.issues,
});
export async function previewVocabularyImport(
  text: string,
): Promise<ImportPreview> {
  const { rows } = await analyzeImport(text);
  return {
    rows: rows.map(previewRow),
    detected: rows.length,
    ready: rows.filter((r) => r.kind === "ready").length,
    invalid: rows.filter((r) => r.kind === "invalid").length,
    existing: rows.filter((r) => r.kind === "existing").length,
    duplicate: rows.filter((r) => r.kind === "duplicate").length,
  };
}
export async function importVocabulary(text: string): Promise<ImportResult> {
  // Never trust browser preview rows/counts. Revalidate and recheck at confirmation.
  const { owner, rows } = await analyzeImport(text);
  const ready = rows.filter((row) => row.kind === "ready");
  let imported = 0;
  const importedRows = new Set<number>();
  const recordResult = (result: {
    upsertedCount: number;
    upsertedIds: Record<number, unknown>;
  }) => {
    imported = result.upsertedCount;
    for (const index of Object.keys(result.upsertedIds))
      importedRows.add(ready[Number(index)].row);
  };
  if (ready.length) {
    // $setOnInsert + unique owner/normalized-word index make retries non-destructive.
    // Construct validated documents first so each upsert includes embedded defaults.
    const operations = ready.map((row) => {
      const doc = new VocabularyWord({
        ...row.data,
        ...owner,
        normalizedWord: row.normalized,
        source: "JSON",
        status: "NEW",
      });
      const value = doc.toObject();
      return {
        updateOne: {
          filter: { ...owner, normalizedWord: row.normalized },
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
    try {
      recordResult(
        await VocabularyWord.bulkWrite(operations, { ordered: false }),
      );
    } catch (error) {
      // Concurrent inserts can race the unique index. Only duplicate write errors
      // count as skipped; infrastructure/validation failures must not report success.
      if (
        error instanceof mongo.MongoBulkWriteError &&
        Array.isArray(error.writeErrors) &&
        error.writeErrors.length &&
        error.writeErrors.every((e) => e.code === 11000) &&
        !error.result.getWriteConcernError()
      ) {
        recordResult(error.result);
      } else throw error;
    }
    if (imported > 0) {
      await ensureUserReviews(owner.userId);
    }
  }
  return {
    imported,
    skippedDuplicates:
      rows.filter((r) => r.kind === "existing" || r.kind === "duplicate")
        .length +
      ready.length -
      imported,
    invalid: rows.filter((r) => r.kind === "invalid").length,
    rows: rows.map((row) =>
      row.kind === "ready" && !importedRows.has(row.row)
        ? {
            ...previewRow(row),
            kind: "existing" as const,
            issues:
              "Saved by another request before this import; skipped without overwriting.",
          }
        : previewRow(row),
    ),
  };
}
