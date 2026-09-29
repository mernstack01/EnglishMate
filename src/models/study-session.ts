import mongoose, { Schema, type Model, type Types } from "mongoose";

export const sessionModules = [
  "VOCABULARY",
  "SYNONYMS",
  "GRAMMAR",
  "MIXED",
] as const;

export type SessionModule = (typeof sessionModules)[number];

export const sessionTypes = [
  "DAILY",
  "DUE",
  "NEW",
  "DIFFICULT",
  "CUSTOM",
  "MISTAKES",
] as const;

export type SessionType = (typeof sessionTypes)[number];

export interface ModuleSessionBreakdown {
  total: number;
  correct: number;
  incorrect: number;
}

export interface StudySessionItem {
  sessionItemId?: string;
  module?: "VOCABULARY" | "SYNONYMS" | "GRAMMAR";
  vocabularyWordId?: Types.ObjectId;
  synonymGroupId?: Types.ObjectId;
  grammarExerciseId?: Types.ObjectId;
  exerciseType: string;
  order: number;
  answered: boolean;
  isCorrect: boolean | null;
  retryCount: number;
  retryOfItemId?: string;
  answeredAt?: Date;
}

export interface StudySessionRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  module: SessionModule;
  grammarTopicId?: Types.ObjectId;
  type: SessionType;
  studyDate?: string;
  startedAt: Date;
  completedAt: Date | null;
  totalQuestions: number;
  plannedQuestions?: number;
  answeredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  activeStudySeconds?: number;
  moduleBreakdown?: {
    vocabulary: ModuleSessionBreakdown;
    synonyms: ModuleSessionBreakdown;
    grammar: ModuleSessionBreakdown;
  };
  items: StudySessionItem[];
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<StudySessionItem>(
  {
    sessionItemId: { type: String, required: false },
    module: {
      type: String,
      enum: ["VOCABULARY", "SYNONYMS", "GRAMMAR"],
      required: false,
    },
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
    retryOfItemId: { type: String, required: false },
    answeredAt: { type: Date, required: false },
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
      enum: sessionModules,
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
    studyDate: {
      type: String,
      required: false,
      trim: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
    totalQuestions: { type: Number, default: 0 },
    plannedQuestions: { type: Number, required: false },
    answeredQuestions: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    incorrectAnswers: { type: Number, default: 0 },
    activeStudySeconds: { type: Number, default: 0 },
    moduleBreakdown: {
      vocabulary: {
        total: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        incorrect: { type: Number, default: 0 },
      },
      synonyms: {
        total: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        incorrect: { type: Number, default: 0 },
      },
      grammar: {
        total: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        incorrect: { type: Number, default: 0 },
      },
    },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true },
);

schema.index({ userId: 1, createdAt: -1 });
schema.index({ userId: 1, completedAt: -1 });
schema.index({ userId: 1, studyDate: 1, type: 1 });

if (mongoose.models.StudySession) {
  const existingModel = mongoose.models.StudySession;
  const moduleField = existingModel.schema.path("module") as unknown as {
    enumValues?: string[];
    options?: { enum?: string[] };
  };
  const hasMixedEnum =
    moduleField?.enumValues?.includes("MIXED") ||
    moduleField?.options?.enum?.includes("MIXED");

  const typeField = existingModel.schema.path("type") as unknown as {
    enumValues?: string[];
    options?: { enum?: string[] };
  };
  const hasMistakesType =
    typeField?.enumValues?.includes("MISTAKES") ||
    typeField?.options?.enum?.includes("MISTAKES");

  if (!hasMixedEnum || !hasMistakesType) {
    delete (mongoose.models as Record<string, unknown>).StudySession;
  }
}

export const StudySession: Model<StudySessionRecord> =
  (mongoose.models.StudySession as Model<StudySessionRecord> | undefined) ??
  mongoose.model<StudySessionRecord>("StudySession", schema);
