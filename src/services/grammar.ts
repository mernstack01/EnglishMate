import "server-only";
import { connectDB } from "@/lib/db/connect";
import { ownedScope, ownedDocumentScope } from "@/lib/db/ownership";
import { vocabularyTimezone } from "@/lib/vocabulary-timezone";
import { dateKey, dayRange } from "@/lib/dates";
import { GrammarTopic, type GrammarTopicRecord } from "@/models/grammar-topic";
import {
  GrammarExercise,
  type GrammarExerciseRecord,
} from "@/models/grammar-exercise";
import { GrammarAttempt } from "@/models/grammar-attempt";
import {
  normalizeGrammarTitle,
  type GrammarCategory,
} from "@/features/grammar/constants";
import {
  grammarTopicInputSchema,
  grammarTopicEditSchema,
  grammarExerciseInputSchema,
  grammarExerciseEditSchema,
  grammarQuerySchema,
  parseGrammarImportJson,
} from "@/validations/grammar";
import type {
  GrammarTopicDTO,
  GrammarExerciseDTO,
  GrammarStatsDTO,
  GrammarImportPreview,
} from "@/types/grammar";
import { type Types, type SortOrder } from "mongoose";

export class GrammarError extends Error {}
const missingTopic = () => new GrammarError("Grammar topic not found.");
const missingExercise = () => new GrammarError("Grammar exercise not found.");
const duplicateTopicError = () =>
  new GrammarError("A grammar topic with this title already exists.");

function isDuplicate(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function topicDTO(
  t: GrammarTopicRecord & { _id: Types.ObjectId },
  timezone: string,
): GrammarTopicDTO {
  return {
    id: t._id.toString(),
    title: t.title,
    category: t.category,
    description: t.description || "",
    content: t.content || "",
    notes: t.notes || "",
    status: t.status,
    exerciseCount: t.exerciseCount || 0,
    accuracy: t.accuracy || 0,
    attemptsCount: t.attemptsCount || 0,
    lastPracticedAt: t.lastPracticedAt?.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    date: dateKey(t.createdAt, timezone),
  };
}

function exerciseDTO(
  e: GrammarExerciseRecord & { _id: Types.ObjectId },
): GrammarExerciseDTO {
  const attempts = e.attemptCount || 0;
  const correct = e.correctCount || 0;
  const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;

  return {
    id: e._id.toString(),
    grammarTopicId: e.grammarTopicId.toString(),
    type: e.type,
    question: e.question,
    options: e.options || [],
    correctAnswer: e.correctAnswer,
    acceptedAnswers: e.acceptedAnswers || [],
    explanation: e.explanation || "",
    difficulty: e.difficulty ?? 2,
    order: e.order ?? 0,
    isActive: e.isActive ?? true,
    attemptCount: attempts,
    correctCount: correct,
    incorrectCount: e.incorrectCount || 0,
    accuracy,
    lastAttemptAt: e.lastAttemptAt?.toISOString(),
    lastIsCorrect: e.lastIsCorrect,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

async function scope() {
  await connectDB();
  return ownedScope();
}

/**
 * -------------------------------------------------------------
 * Grammar Topics CRUD
 * -------------------------------------------------------------
 */

export async function createGrammarTopic(
  input: unknown,
): Promise<GrammarTopicDTO> {
  const owner = await scope();
  const valid = grammarTopicInputSchema.parse(input);
  const normalizedTitle = normalizeGrammarTitle(valid.title);

  const existing = await GrammarTopic.findOne({
    userId: owner.userId,
    normalizedTitle,
  }).lean();

  if (existing) throw duplicateTopicError();

  try {
    const doc = await GrammarTopic.create({
      userId: owner.userId,
      title: valid.title,
      normalizedTitle,
      category: valid.category,
      description: valid.description,
      content: valid.content,
      notes: valid.notes,
      status: "NEW",
    });

    const timezone = vocabularyTimezone();
    return topicDTO(doc, timezone);
  } catch (error) {
    if (isDuplicate(error)) throw duplicateTopicError();
    throw error;
  }
}

export async function updateGrammarTopic(
  id: string,
  input: unknown,
): Promise<GrammarTopicDTO> {
  const owner = await scope();
  const valid = grammarTopicEditSchema.parse(input);
  const normalizedTitle = normalizeGrammarTitle(valid.title);

  const docScope = await ownedDocumentScope(id);
  const topic = await GrammarTopic.findOne(docScope);
  if (!topic) throw missingTopic();

  // If title changed, check duplicate
  if (topic.normalizedTitle !== normalizedTitle) {
    const dup = await GrammarTopic.findOne({
      userId: owner.userId,
      normalizedTitle,
      _id: { $ne: topic._id },
    }).lean();
    if (dup) throw duplicateTopicError();
  }

  topic.title = valid.title;
  topic.normalizedTitle = normalizedTitle;
  topic.category = valid.category;
  topic.description = valid.description;
  topic.content = valid.content;
  topic.notes = valid.notes;
  if (valid.status) {
    topic.status = valid.status;
  }

  try {
    await topic.save();
    const timezone = vocabularyTimezone();
    return topicDTO(topic, timezone);
  } catch (error) {
    if (isDuplicate(error)) throw duplicateTopicError();
    throw error;
  }
}

export async function deleteGrammarTopic(id: string): Promise<void> {
  const owner = await scope();
  const docScope = await ownedDocumentScope(id);
  const topic = await GrammarTopic.findOne(docScope);
  if (!topic) throw missingTopic();

  // Safe atomic cleanup cascade: topic, exercises, attempts
  await Promise.all([
    GrammarTopic.deleteOne({ _id: topic._id }),
    GrammarExercise.deleteMany({
      userId: owner.userId,
      grammarTopicId: topic._id,
    }),
    GrammarAttempt.deleteMany({
      userId: owner.userId,
      grammarTopicId: topic._id,
    }),
  ]);
}

export async function getGrammarTopic(id: string): Promise<GrammarTopicDTO> {
  await scope();
  const docScope = await ownedDocumentScope(id);
  const doc = await GrammarTopic.findOne(docScope).lean<
    GrammarTopicRecord & { _id: Types.ObjectId }
  >();

  if (!doc) throw missingTopic();
  const timezone = vocabularyTimezone();
  return topicDTO(doc, timezone);
}

export async function listGrammarTopics(query: unknown = {}) {
  const owner = await scope();
  const parsed = grammarQuerySchema.parse(query);
  const timezone = vocabularyTimezone();

  const filter: Record<string, unknown> = { userId: owner.userId };

  if (parsed.category !== "ALL") {
    filter.category = parsed.category;
  }

  if (parsed.status !== "ALL") {
    filter.status = parsed.status;
  }

  if (parsed.date) {
    filter.createdAt = dayRange(parsed.date, timezone);
  }

  if (parsed.q) {
    const escaped = parsed.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [{ title: regex }, { description: regex }];
  }

  let sort: Record<string, SortOrder> = { createdAt: -1 };
  if (parsed.sort === "oldest") sort = { createdAt: 1 };
  else if (parsed.sort === "az") sort = { normalizedTitle: 1 };
  else if (parsed.sort === "za") sort = { normalizedTitle: -1 };
  else if (parsed.sort === "accuracy")
    sort = { accuracy: 1, attemptsCount: -1 };
  else if (parsed.sort === "practice")
    sort = { exerciseCount: -1, attemptsCount: 1 };

  const skip = (parsed.page - 1) * parsed.limit;

  const [total, rows] = await Promise.all([
    GrammarTopic.countDocuments(filter),
    GrammarTopic.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parsed.limit)
      .lean<Array<GrammarTopicRecord & { _id: Types.ObjectId }>>(),
  ]);

  return {
    topics: rows.map((r) => topicDTO(r, timezone)),
    total,
    page: parsed.page,
    limit: parsed.limit,
    pages: Math.max(1, Math.ceil(total / parsed.limit)),
    query: parsed,
  };
}

export async function grammarToday(query: unknown = {}) {
  const parsed = grammarQuerySchema.parse(query);
  const timezone = vocabularyTimezone();
  const today = dateKey(new Date(), timezone);
  return listGrammarTopics({ ...parsed, date: today });
}

export async function grammarStats(): Promise<GrammarStatsDTO> {
  const owner = await scope();

  const [
    totalTopics,
    newCount,
    learningCount,
    difficultCount,
    learnedCount,
    exercisesAgg,
    practicedExercisesCount,
  ] = await Promise.all([
    GrammarTopic.countDocuments({ userId: owner.userId }),
    GrammarTopic.countDocuments({ userId: owner.userId, status: "NEW" }),
    GrammarTopic.countDocuments({ userId: owner.userId, status: "LEARNING" }),
    GrammarTopic.countDocuments({ userId: owner.userId, status: "DIFFICULT" }),
    GrammarTopic.countDocuments({ userId: owner.userId, status: "LEARNED" }),
    GrammarExercise.aggregate<{
      _id: null;
      total: number;
      correct: number;
      attempts: number;
    }>([
      { $match: { userId: owner.userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          correct: { $sum: "$correctCount" },
          attempts: { $sum: "$attemptCount" },
        },
      },
    ]),
    GrammarExercise.countDocuments({
      userId: owner.userId,
      attemptCount: { $gt: 0 },
    }),
  ]);

  const agg = exercisesAgg[0] || { total: 0, correct: 0, attempts: 0 };
  const accuracy =
    agg.attempts > 0 ? Math.round((agg.correct / agg.attempts) * 100) : 0;

  // Topics that need practice: status != LEARNED, or accuracy < 75%
  const needsPracticeCount = await GrammarTopic.countDocuments({
    userId: owner.userId,
    $or: [
      { status: { $in: ["NEW", "DIFFICULT", "LEARNING"] } },
      { accuracy: { $lt: 75 } },
    ],
    exerciseCount: { $gt: 0 },
  });

  return {
    totalTopics,
    totalExercises: agg.total,
    exercisesPracticed: practicedExercisesCount,
    accuracy,
    needsPracticeCount,
    newCount,
    learningCount,
    difficultCount,
    learnedCount,
  };
}

/**
 * -------------------------------------------------------------
 * Grammar Exercises CRUD
 * -------------------------------------------------------------
 */

export async function createGrammarExercise(
  topicId: string,
  input: unknown,
): Promise<GrammarExerciseDTO> {
  const owner = await scope();
  const topicScope = await ownedDocumentScope(topicId);
  const topic = await GrammarTopic.findOne(topicScope);
  if (!topic) throw missingTopic();

  const valid = grammarExerciseInputSchema.parse(input);

  const doc = await GrammarExercise.create({
    userId: owner.userId,
    grammarTopicId: topic._id,
    type: valid.type,
    question: valid.question,
    options: valid.options,
    correctAnswer: valid.correctAnswer,
    acceptedAnswers: valid.acceptedAnswers,
    explanation: valid.explanation,
    difficulty: valid.difficulty,
    order: valid.order,
    isActive: valid.isActive,
  });

  // Increment exercise count on topic
  await GrammarTopic.updateOne(
    { _id: topic._id },
    { $inc: { exerciseCount: 1 } },
  );

  return exerciseDTO(doc);
}

export async function updateGrammarExercise(
  exerciseId: string,
  input: unknown,
): Promise<GrammarExerciseDTO> {
  const valid = grammarExerciseEditSchema.parse(input);

  const exScope = await ownedDocumentScope(exerciseId);
  const exercise = await GrammarExercise.findOne(exScope);
  if (!exercise) throw missingExercise();

  exercise.type = valid.type;
  exercise.question = valid.question;
  exercise.options = valid.options;
  exercise.correctAnswer = valid.correctAnswer;
  exercise.acceptedAnswers = valid.acceptedAnswers;
  exercise.explanation = valid.explanation;
  exercise.difficulty = valid.difficulty;
  exercise.order = valid.order;
  exercise.isActive = valid.isActive;

  await exercise.save();
  return exerciseDTO(exercise);
}

export async function deleteGrammarExercise(exerciseId: string): Promise<void> {
  const owner = await scope();
  const exScope = await ownedDocumentScope(exerciseId);
  const exercise = await GrammarExercise.findOne(exScope);
  if (!exercise) throw missingExercise();

  await Promise.all([
    GrammarExercise.deleteOne({ _id: exercise._id }),
    GrammarTopic.updateOne(
      { _id: exercise.grammarTopicId, exerciseCount: { $gt: 0 } },
      { $inc: { exerciseCount: -1 } },
    ),
    GrammarAttempt.deleteMany({
      userId: owner.userId,
      grammarExerciseId: exercise._id,
    }),
  ]);
}

export async function getGrammarExercise(
  exerciseId: string,
): Promise<GrammarExerciseDTO> {
  await scope();
  const exScope = await ownedDocumentScope(exerciseId);
  const doc = await GrammarExercise.findOne(exScope).lean<
    GrammarExerciseRecord & { _id: Types.ObjectId }
  >();

  if (!doc) throw missingExercise();
  return exerciseDTO(doc);
}

export async function listGrammarExercises(
  topicId: string,
): Promise<GrammarExerciseDTO[]> {
  const owner = await scope();
  const topicScope = await ownedDocumentScope(topicId);
  const topic = await GrammarTopic.findOne(topicScope).lean();
  if (!topic) throw missingTopic();

  const rows = await GrammarExercise.find({
    userId: owner.userId,
    grammarTopicId: topic._id,
  })
    .sort({ order: 1, createdAt: 1 })
    .lean<Array<GrammarExerciseRecord & { _id: Types.ObjectId }>>();

  return rows.map(exerciseDTO);
}

/**
 * -------------------------------------------------------------
 * JSON Import Operations
 * -------------------------------------------------------------
 */

export async function previewGrammarImport(
  rawJson: string,
  existingTopicId?: string,
): Promise<GrammarImportPreview> {
  await scope();
  let existingTopic: { id: string; title: string } | undefined;

  if (existingTopicId) {
    const topicScope = await ownedDocumentScope(existingTopicId);
    const topic = await GrammarTopic.findOne(topicScope).lean();
    if (!topic) throw missingTopic();
    existingTopic = { id: topic._id.toString(), title: topic.title };
  }

  return parseGrammarImportJson(rawJson, existingTopic);
}

export async function confirmGrammarImport(payload: {
  mode: "NEW_TOPIC" | "EXISTING_TOPIC";
  targetTopicId?: string;
  title: string;
  category: GrammarCategory;
  description?: string;
  content?: string;
  notes?: string;
  exercises: Array<{
    type: string;
    question: string;
    options: string[];
    correctAnswer: string;
    acceptedAnswers: string[];
    explanation?: string;
    difficulty?: number;
  }>;
}): Promise<{ topicId: string; importedCount: number }> {
  const owner = await scope();
  let targetTopicId: Types.ObjectId;

  if (payload.mode === "EXISTING_TOPIC" && payload.targetTopicId) {
    const topicScope = await ownedDocumentScope(payload.targetTopicId);
    const topic = await GrammarTopic.findOne(topicScope);
    if (!topic) throw missingTopic();
    targetTopicId = topic._id;
  } else {
    // Create new topic
    const normalizedTitle = normalizeGrammarTitle(payload.title);
    const existing = await GrammarTopic.findOne({
      userId: owner.userId,
      normalizedTitle,
    }).lean();

    if (existing) {
      targetTopicId = existing._id;
    } else {
      const created = await GrammarTopic.create({
        userId: owner.userId,
        title: payload.title.trim(),
        normalizedTitle,
        category: payload.category || "OTHER",
        description: payload.description || "",
        content: payload.content || "",
        notes: payload.notes || "",
        status: "NEW",
      });
      targetTopicId = created._id;
    }
  }

  if (payload.exercises.length === 0) {
    return { topicId: targetTopicId.toString(), importedCount: 0 };
  }

  const exerciseDocs = payload.exercises.map((ex, index) => ({
    userId: owner.userId,
    grammarTopicId: targetTopicId,
    type: ex.type,
    question: ex.question.trim(),
    options: ex.options || [],
    correctAnswer: ex.correctAnswer.trim(),
    acceptedAnswers: ex.acceptedAnswers || [],
    explanation: ex.explanation?.trim() || "",
    difficulty: ex.difficulty || 2,
    order: index,
    isActive: true,
  }));

  const inserted = await GrammarExercise.insertMany(exerciseDocs);

  // Update exercise count on topic
  await GrammarTopic.updateOne(
    { _id: targetTopicId },
    { $inc: { exerciseCount: inserted.length } },
  );

  return { topicId: targetTopicId.toString(), importedCount: inserted.length };
}
