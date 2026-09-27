import mongoose, { Schema, type Model, type Types } from "mongoose";

export const sessionTypes = [
  "DAILY",
  "DUE",
  "NEW",
  "DIFFICULT",
  "CUSTOM",
] as const;

export type SessionType = (typeof sessionTypes)[number];

export interface StudySessionItem {
  vocabularyWordId?: Types.ObjectId;
  synonymGroupId?: Types.ObjectId;
  grammarExerciseId?: Types.ObjectId;
  exerciseType: string;
  order: number;
  answered: boolean;
  isCorrect: boolean | null;
  retryCount: number;
}

export interface StudySessionRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  module: "VOCABULARY" | "SYNONYMS" | "GRAMMAR";
  grammarTopicId?: Types.ObjectId;
  type: SessionType;
  startedAt: Date;
  completedAt: Date | null;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  items: StudySessionItem[];
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<StudySessionItem>(
  {
    vocabularyWordId: {
      type: Schema.Types.ObjectId,
      ref: "VocabularyWord",
      required: false,
    },
    synonymGroupId: {
      type: Schema.Types.ObjectId,
      ref: "SynonymGroup",
      required: false,
    },
    grammarExerciseId: {
      type: Schema.Types.ObjectId,
      ref: "GrammarExercise",
      required: false,
    },
    exerciseType: { type: String, required: true },
    order: { type: Number, required: true },
    answered: { type: Boolean, default: false },
    isCorrect: { type: Boolean, default: null },
    retryCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const schema = new Schema<StudySessionRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    module: {
      type: String,
      enum: ["VOCABULARY", "SYNONYMS", "GRAMMAR"],
      required: true,
      default: "VOCABULARY",
    },
    grammarTopicId: {
      type: Schema.Types.ObjectId,
      ref: "GrammarTopic",
      required: false,
    },
    type: {
      type: String,
      enum: sessionTypes,
      required: true,
      default: "DAILY",
    },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
    totalQuestions: { type: Number, default: 0 },
    answeredQuestions: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    incorrectAnswers: { type: Number, default: 0 },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true },
);

schema.index({ userId: 1, createdAt: -1 });
schema.index({ userId: 1, completedAt: -1 });

if (mongoose.models.StudySession) {
  const existingModel = mongoose.models.StudySession;
  const hasGrammarTopicId = Boolean(
    existingModel.schema.path("grammarTopicId"),
  );
  const moduleField = existingModel.schema.path("module") as unknown as {
    enumValues?: string[];
    options?: { enum?: string[] };
  };
  const hasGrammarEnum =
    moduleField?.enumValues?.includes("GRAMMAR") ||
    moduleField?.options?.enum?.includes("GRAMMAR");

  if (!hasGrammarTopicId || !hasGrammarEnum) {
    delete (mongoose.models as Record<string, unknown>).StudySession;
  }
}

export const StudySession: Model<StudySessionRecord> =
  (mongoose.models.StudySession as Model<StudySessionRecord> | undefined) ??
  mongoose.model<StudySessionRecord>("StudySession", schema);
