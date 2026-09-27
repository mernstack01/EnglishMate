import "server-only";
import { SynonymGroup, type SynonymGroupRecord } from "@/models/synonym-group";
import { SynonymReview } from "@/models/synonym-review";
import { connectDB } from "@/lib/db/connect";
import { ownedScope, ownedDocumentScope } from "@/lib/db/ownership";
import { vocabularyTimezone } from "@/lib/vocabulary-timezone";
import { dateKey, dayRange, monthKeys, startOfDay } from "@/lib/dates";
import {
  synonymGroupInputSchema,
  editSynonymGroupSchema,
  synonymGroupIdSchema,
  synonymStatusInputSchema,
  synonymQuerySchema,
  parseSynonymImport,
  synonymMonthSchema,
} from "@/validations/synonyms";
import { normalizeSynonymTerm } from "@/features/synonyms/constants";
import type {
  SynonymGroupDTO,
  SynonymImportPreview,
  SynonymImportResult,
  SynonymStatsDTO,
} from "@/types/synonyms";
import { type Types, type SortOrder } from "mongoose";

export class SynonymError extends Error {}
const missing = () => new SynonymError("Synonym group not found.");
const duplicateError = () =>
  new SynonymError("This synonym group term already exists in your notebook.");

function isDuplicate(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function dto(
  group: SynonymGroupRecord & { _id: Types.ObjectId },
  timezone: string,
): SynonymGroupDTO {
  return {
    id: group._id.toString(),
    term: group.term,
    meaning: group.meaning,
    notes: group.notes,
    synonyms: group.synonyms.map((s) => ({
      word: s.word,
      example: s.example || undefined,
    })),
    status: group.status,
    source: group.source,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    date: dateKey(group.createdAt, timezone),
    nextReviewAt: group.review?.nextReviewAt?.toISOString(),
    intervalDays: group.review?.intervalDays,
  };
}

async function scope() {
  const owner = await ownedScope();
  await connectDB();
  return owner;
}

async function documentScope(id: unknown) {
  await ownedScope();
  if (!synonymGroupIdSchema.safeParse(id).success) throw missing();
  const owner = await ownedDocumentScope(id as string);
  await connectDB();
  return owner;
}

export async function createSynonymGroup(input: unknown): Promise<string> {
  const owner = await scope();
  const data = synonymGroupInputSchema.parse(input);
  try {
    const group = await SynonymGroup.create({
      ...data,
      ...owner,
      normalizedTerm: normalizeSynonymTerm(data.term),
      status: "NEW",
      source: "MANUAL",
      synonyms: data.synonyms.map((s) => ({
        word: s.word,
        normalizedWord: normalizeSynonymTerm(s.word),
        example: s.example || "",
      })),
    });

    await SynonymReview.create({
      userId: owner.userId,
      synonymGroupId: group._id,
      nextReviewAt: group.review.nextReviewAt,
    }).catch(() => {});

    return group._id.toString();
  } catch (error) {
    if (isDuplicate(error)) throw duplicateError();
    throw error;
  }
}

export async function getSynonymGroup(id: unknown): Promise<SynonymGroupDTO> {
  const owner = await documentScope(id);
  const group = await SynonymGroup.findOne(owner).lean();
  if (!group) throw missing();
  return dto(group, vocabularyTimezone());
}

export async function updateSynonymGroup(
  id: unknown,
  input: unknown,
): Promise<void> {
  const owner = await documentScope(id);
  if (!(await SynonymGroup.exists(owner))) throw missing();
  const data = editSynonymGroupSchema.parse(input);
  try {
    const result = await SynonymGroup.updateOne(
      owner,
      {
        $set: {
          term: data.term,
          normalizedTerm: normalizeSynonymTerm(data.term),
          meaning: data.meaning,
          notes: data.notes,
          status: data.status,
          synonyms: data.synonyms.map((s) => ({
            word: s.word,
            normalizedWord: normalizeSynonymTerm(s.word),
            example: s.example || "",
          })),
        },
      },
      { runValidators: true },
    );
    if (!result.matchedCount) throw missing();
  } catch (error) {
    if (isDuplicate(error)) throw duplicateError();
    throw error;
  }
}

export async function changeSynonymGroupStatus(input: unknown): Promise<void> {
  await ownedScope();
  const data = synonymStatusInputSchema.parse(input);
  const owner = await documentScope(data.id);
  const result = await SynonymGroup.updateOne(
    owner,
    { $set: { status: data.status } },
    { runValidators: true },
  );
  if (!result.matchedCount) throw missing();
}

export async function deleteSynonymGroup(id: unknown): Promise<void> {
  const owner = await documentScope(id);
  const result = await SynonymGroup.deleteOne(owner);
  if (!result.deletedCount) throw missing();

  await SynonymReview.deleteMany({
    userId: owner.userId,
    synonymGroupId: owner._id,
  }).catch(() => {});
}

export async function listSynonymGroups(input: unknown) {
  const owner = await scope();
  const query = synonymQuerySchema.parse(input);
  const timezone = vocabularyTimezone();
  const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const filter = {
    ...owner,
    ...(query.status !== "ALL" ? { status: query.status } : {}),
    ...(query.date ? { createdAt: dayRange(query.date, timezone) } : {}),
    ...(escaped
      ? {
          $or: [
            { term: { $regex: escaped, $options: "i" } },
            { meaning: { $regex: escaped, $options: "i" } },
            { "synonyms.word": { $regex: escaped, $options: "i" } },
          ],
        }
      : {}),
  };

  const total = await SynonymGroup.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(query.page, pages);

  const sortOrder: Record<string, 1 | -1> =
    query.sort === "oldest"
      ? { createdAt: 1, _id: 1 }
      : query.sort === "az"
        ? { term: 1, _id: 1 }
        : query.sort === "za"
          ? { term: -1, _id: -1 }
          : { createdAt: -1, _id: -1 };

  const groups = await SynonymGroup.find(filter)
    .sort(sortOrder as Record<string, SortOrder>)
    .skip((page - 1) * 20)
    .limit(20)
    .lean();

  return {
    groups: groups.map((g) => dto(g, timezone)),
    page,
    pages,
    total,
    query,
  };
}

export async function synonymsToday(input: unknown) {
  const timezone = vocabularyTimezone();
  const today = dateKey(new Date(), timezone);
  const parsed = synonymQuerySchema.parse(
    input && typeof input === "object" ? input : {},
  );
  return listSynonymGroups({ ...parsed, date: today });
}

export async function synonymsCalendar(month: unknown) {
  const owner = await scope();
  const validMonth = synonymMonthSchema.parse(month);
  const timezone = vocabularyTimezone();
  const keys = monthKeys(validMonth);

  const counts = await SynonymGroup.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        userId: owner.userId,
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
  ]);

  return {
    month: validMonth,
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    timezone,
    ...keys,
  };
}

export async function synonymStats(): Promise<SynonymStatsDTO> {
  const owner = await scope();
  const timezone = vocabularyTimezone();
  const todayRange = dayRange(dateKey(new Date(), timezone), timezone);
  const now = new Date();

  const [total, newToday, due, learned, difficult] = await Promise.all([
    SynonymGroup.countDocuments(owner),
    SynonymGroup.countDocuments({ ...owner, createdAt: todayRange }),
    SynonymGroup.countDocuments({
      ...owner,
      "review.nextReviewAt": { $lte: now },
    }),
    SynonymGroup.countDocuments({ ...owner, status: "LEARNED" }),
    SynonymGroup.countDocuments({ ...owner, status: "DIFFICULT" }),
  ]);

  return { total, newToday, due, learned, difficult };
}

export async function previewSynonymImport(
  jsonText: string,
): Promise<SynonymImportPreview> {
  const owner = await scope();
  const rows = parseSynonymImport(jsonText);

  const readyTerms = rows
    .filter((r) => r.kind === "ready" && r.normalized)
    .map((r) => r.normalized!);

  const existingTerms = new Set<string>();
  if (readyTerms.length) {
    const existing = await SynonymGroup.find({
      userId: owner.userId,
      normalizedTerm: { $in: readyTerms },
    })
      .select("normalizedTerm")
      .lean();

    existing.forEach((g) => existingTerms.add(g.normalizedTerm));
  }

  const items = rows.map((r) => {
    if (r.kind === "invalid") {
      return {
        term: r.term,
        meaning: "",
        notes: "",
        synonyms: [],
        status: "INVALID" as const,
        reason: r.issues,
      };
    }

    if (r.kind === "duplicate") {
      return {
        term: r.term,
        meaning: r.meaning,
        notes: r.notes,
        synonyms: r.synonyms,
        status: "DUPLICATE" as const,
        reason: r.issues,
      };
    }

    if (existingTerms.has(r.normalized!)) {
      return {
        term: r.term,
        meaning: r.meaning,
        notes: r.notes,
        synonyms: r.synonyms,
        status: "DUPLICATE" as const,
        reason: "Already exists in your synonym notebook.",
      };
    }

    return {
      term: r.term,
      meaning: r.meaning,
      notes: r.notes,
      synonyms: r.synonyms,
      status: "READY" as const,
    };
  });

  const ready = items.filter((i) => i.status === "READY").length;
  const duplicates = items.filter((i) => i.status === "DUPLICATE").length;
  const invalid = items.filter((i) => i.status === "INVALID").length;

  return {
    total: items.length,
    ready,
    duplicates,
    invalid,
    items,
  };
}

export async function confirmSynonymImport(
  readyItems: unknown[],
): Promise<SynonymImportResult> {
  const owner = await scope();
  if (!Array.isArray(readyItems) || !readyItems.length) {
    return { saved: 0, skipped: 0, total: 0 };
  }

  let saved = 0;
  let skipped = 0;

  for (const item of readyItems) {
    const parsed = synonymGroupInputSchema.safeParse(item);
    if (!parsed.success) {
      skipped++;
      continue;
    }

    try {
      const group = await SynonymGroup.create({
        ...parsed.data,
        ...owner,
        normalizedTerm: normalizeSynonymTerm(parsed.data.term),
        status: "NEW",
        source: "JSON",
        synonyms: parsed.data.synonyms.map((s) => ({
          word: s.word,
          normalizedWord: normalizeSynonymTerm(s.word),
          example: s.example || "",
        })),
      });

      await SynonymReview.create({
        userId: owner.userId,
        synonymGroupId: group._id,
        nextReviewAt: group.review.nextReviewAt,
      }).catch(() => {});

      saved++;
    } catch (error) {
      if (isDuplicate(error)) {
        skipped++;
      } else {
        throw error;
      }
    }
  }

  return { saved, skipped, total: readyItems.length };
}

export async function ensureUserSynonymReviews(
  userId: Types.ObjectId,
): Promise<void> {
  const groups = await SynonymGroup.find({ userId })
    .select("_id review")
    .lean();
  if (!groups.length) return;

  const existingReviews = await SynonymReview.find({ userId })
    .select("synonymGroupId")
    .lean();

  const reviewedIds = new Set(
    existingReviews.map((r) => r.synonymGroupId.toString()),
  );

  const missing = groups.filter((g) => !reviewedIds.has(g._id.toString()));
  if (!missing.length) return;

  const toInsert = missing.map((g) => ({
    userId,
    synonymGroupId: g._id,
    nextReviewAt: g.review?.nextReviewAt || new Date(),
    lastReviewedAt: g.review?.lastReviewedAt || null,
    intervalDays: g.review?.intervalDays || 0,
    easeFactor: g.review?.easeFactor || 2.5,
    repetitions: g.review?.repetitions || 0,
    correctCount: g.review?.correctCount || 0,
    incorrectCount: g.review?.incorrectCount || 0,
  }));

  await SynonymReview.insertMany(toInsert, { ordered: false }).catch(() => {});
}
