import { z } from "zod";
import { isDateKey } from "@/lib/dates";
import {
  grammarCategories,
  grammarStatuses,
  grammarExerciseTypes,
  normalizeGrammarTitle,
  normalizeGrammarAnswer,
  normalizeBooleanString,
  MAX_GRAMMAR_IMPORT_BYTES,
  MAX_GRAMMAR_IMPORT_ROWS,
} from "@/features/grammar/constants";
import type {
  GrammarExerciseType,
  GrammarImportPreview,
  GrammarImportPreviewExercise,
} from "@/types/grammar";

const optionalText = (max: number) => z.string().trim().max(max).default("");

export const grammarTopicInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a topic title.")
    .max(160, "Topic title must be 160 characters or less.")
    .refine(
      (v) => normalizeGrammarTitle(v).length > 0,
      "Topic title cannot be only spaces.",
    ),
  category: z.enum(grammarCategories, {
    message: "Select a valid grammar category.",
  }),
  description: optionalText(500),
  content: optionalText(20000),
  notes: optionalText(4000),
});

export const grammarTopicEditSchema = grammarTopicInputSchema.extend({
  status: z.enum(grammarStatuses).optional(),
});

export const grammarExerciseInputSchema = z
  .object({
    type: z.enum(grammarExerciseTypes, {
      message: "Select a valid exercise type.",
    }),
    question: z
      .string()
      .trim()
      .min(1, "Enter a question or prompt.")
      .max(1000, "Question must be 1,000 characters or less."),
    options: z.array(z.string().trim()).default([]),
    correctAnswer: z
      .string()
      .trim()
      .min(1, "Enter the correct answer.")
      .max(500, "Correct answer must be 500 characters or less."),
    acceptedAnswers: z.array(z.string().trim()).default([]),
    explanation: optionalText(2000),
    difficulty: z.coerce.number().int().min(1).max(5).default(2),
    order: z.coerce.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.type === "MULTIPLE_CHOICE") {
      const normalizedOpts = data.options
        .map((o) => o.trim())
        .filter((o) => o.length > 0);

      if (normalizedOpts.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Multiple choice requires at least 2 distinct options.",
          path: ["options"],
        });
        return;
      }

      const uniqueNorms = new Set(normalizedOpts.map(normalizeGrammarAnswer));
      if (uniqueNorms.size !== normalizedOpts.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Options must be distinct from one another.",
          path: ["options"],
        });
        return;
      }

      const normalizedCorrect = normalizeGrammarAnswer(data.correctAnswer);
      if (!uniqueNorms.has(normalizedCorrect)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "The correct answer must be one of the listed options.",
          path: ["correctAnswer"],
        });
      }
    } else if (data.type === "TRUE_FALSE") {
      const boolVal = normalizeBooleanString(data.correctAnswer);
      if (!boolVal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Correct answer for True/False must be 'true' or 'false'.",
          path: ["correctAnswer"],
        });
      }
    }
  });

export const grammarExerciseEditSchema = grammarExerciseInputSchema;

export const grammarQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  category: z
    .enum([...grammarCategories, "ALL"] as const)
    .catch("ALL")
    .default("ALL"),
  status: z
    .enum([...grammarStatuses, "ALL"] as const)
    .catch("ALL")
    .default("ALL"),
  sort: z
    .enum(["newest", "oldest", "az", "za", "accuracy", "practice"] as const)
    .catch("newest")
    .default("newest"),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).catch(12).default(12),
  date: z
    .string()
    .trim()
    .refine((v) => !v || isDateKey(v), "Date must be YYYY-MM-DD")
    .optional(),
});

export type GrammarQuery = z.infer<typeof grammarQuerySchema>;

export const grammarAnswerSchema = z.object({
  exerciseId: z.string().trim().min(1),
  answer: z.string().trim().min(1, "Please provide an answer."),
});

/**
 * Validates and normalizes raw JSON import payloads for grammar topics & exercises.
 */
export function parseGrammarImportJson(
  rawText: string,
  existingTopic?: { id: string; title: string },
): GrammarImportPreview {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("Pasted JSON content is empty.");
  }

  if (Buffer.byteLength(trimmed, "utf8") > MAX_GRAMMAR_IMPORT_BYTES) {
    throw new Error(
      `JSON payload exceeds limit of ${Math.round(MAX_GRAMMAR_IMPORT_BYTES / 1024)} KB.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Invalid JSON format. Please verify syntax.");
  }

  let title = existingTopic?.title ?? "";
  let category: (typeof grammarCategories)[number] = "OTHER";
  let description = "";
  let content = "";
  let notes = "";
  let rawExercises: unknown[] = [];

  if (Array.isArray(parsed)) {
    // Array of exercises
    rawExercises = parsed;
    if (!existingTopic) {
      title = "Imported Grammar Exercises";
    }
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.title === "string" && obj.title.trim()) {
      title = obj.title.trim();
    }
    if (
      typeof obj.category === "string" &&
      grammarCategories.includes(
        obj.category as (typeof grammarCategories)[number],
      )
    ) {
      category = obj.category as (typeof grammarCategories)[number];
    }
    if (typeof obj.description === "string") {
      description = obj.description.trim();
    }
    if (typeof obj.content === "string") {
      content = obj.content.trim();
    }
    if (typeof obj.notes === "string") {
      notes = obj.notes.trim();
    }

    if (Array.isArray(obj.exercises)) {
      rawExercises = obj.exercises;
    } else if (Array.isArray(obj.questions)) {
      rawExercises = obj.questions;
    }
  } else {
    throw new Error(
      "Expected a JSON object with topic details or an array of exercises.",
    );
  }

  if (!title) {
    title = "Imported Grammar Topic";
  }

  if (rawExercises.length > MAX_GRAMMAR_IMPORT_ROWS) {
    throw new Error(
      `You can import up to ${MAX_GRAMMAR_IMPORT_ROWS} exercises at once. Found ${rawExercises.length}.`,
    );
  }

  const exercises: GrammarImportPreviewExercise[] = [];

  for (let i = 0; i < rawExercises.length; i++) {
    const raw = rawExercises[i];
    if (!raw || typeof raw !== "object") {
      exercises.push({
        type: "MULTIPLE_CHOICE",
        question: `Exercise #${i + 1}`,
        options: [],
        correctAnswer: "",
        acceptedAnswers: [],
        explanation: "",
        difficulty: 2,
        status: "INVALID",
        reason: "Item must be a JSON object.",
      });
      continue;
    }

    const item = raw as Record<string, unknown>;
    const typeStr = String(item.type || "").toUpperCase();
    const type: GrammarExerciseType = grammarExerciseTypes.includes(
      typeStr as GrammarExerciseType,
    )
      ? (typeStr as GrammarExerciseType)
      : "MULTIPLE_CHOICE";

    const question = String(item.question || item.prompt || "").trim();
    const correctAnswer = String(
      item.correctAnswer || item.answer || item.correct || "",
    ).trim();
    const explanation = String(item.explanation || item.note || "").trim();
    const difficulty =
      typeof item.difficulty === "number" &&
      item.difficulty >= 1 &&
      item.difficulty <= 5
        ? item.difficulty
        : 2;

    const rawOptions = Array.isArray(item.options) ? item.options : [];
    const options = rawOptions.map((o) => String(o).trim()).filter(Boolean);

    const rawAccepted = Array.isArray(item.acceptedAnswers)
      ? item.acceptedAnswers
      : Array.isArray(item.accepted)
        ? item.accepted
        : [];
    const acceptedAnswers = rawAccepted
      .map((a) => String(a).trim())
      .filter(Boolean);

    if (!question) {
      exercises.push({
        type,
        question: `[Missing question]`,
        options,
        correctAnswer,
        acceptedAnswers,
        explanation,
        difficulty,
        status: "INVALID",
        reason: "Question text is required.",
      });
      continue;
    }

    if (!correctAnswer) {
      exercises.push({
        type,
        question,
        options,
        correctAnswer: "[Missing]",
        acceptedAnswers,
        explanation,
        difficulty,
        status: "INVALID",
        reason: "Correct answer is required.",
      });
      continue;
    }

    if (type === "MULTIPLE_CHOICE") {
      if (options.length < 2) {
        exercises.push({
          type,
          question,
          options,
          correctAnswer,
          acceptedAnswers,
          explanation,
          difficulty,
          status: "INVALID",
          reason: "Multiple choice requires at least 2 options.",
        });
        continue;
      }

      const uniqueOpts = new Set(options.map(normalizeGrammarAnswer));
      if (uniqueOpts.size !== options.length) {
        exercises.push({
          type,
          question,
          options,
          correctAnswer,
          acceptedAnswers,
          explanation,
          difficulty,
          status: "INVALID",
          reason: "Options contains duplicate choices.",
        });
        continue;
      }

      const normCorrect = normalizeGrammarAnswer(correctAnswer);
      if (!uniqueOpts.has(normCorrect)) {
        exercises.push({
          type,
          question,
          options,
          correctAnswer,
          acceptedAnswers,
          explanation,
          difficulty,
          status: "INVALID",
          reason: "Correct answer is not among the options.",
        });
        continue;
      }
    } else if (type === "TRUE_FALSE") {
      const boolVal = normalizeBooleanString(correctAnswer);
      if (!boolVal) {
        exercises.push({
          type,
          question,
          options: ["true", "false"],
          correctAnswer,
          acceptedAnswers,
          explanation,
          difficulty,
          status: "INVALID",
          reason:
            "Correct answer for True/False must resolve to true or false.",
        });
        continue;
      }
    }

    exercises.push({
      type,
      question,
      options,
      correctAnswer,
      acceptedAnswers,
      explanation,
      difficulty,
      status: "READY",
    });
  }

  const readyCount = exercises.filter((e) => e.status === "READY").length;
  const invalidCount = exercises.filter((e) => e.status === "INVALID").length;

  return {
    mode: existingTopic ? "EXISTING_TOPIC" : "NEW_TOPIC",
    targetTopicId: existingTopic?.id,
    targetTopicTitle: existingTopic?.title,
    title,
    category,
    description,
    content,
    notes,
    totalDetected: exercises.length,
    readyCount,
    invalidCount,
    exercises,
  };
}
