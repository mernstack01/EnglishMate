import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { ReviewRating } from "./vocabulary-review";

export const exerciseTypes = [
  "MULTIPLE_CHOICE",
  "EN_TO_UZ",
  "UZ_TO_EN",
  "TYPING",
  "FILL_BLANK",
  "MATCH",
] as const;

export type ExerciseType = (typeof exerciseTypes)[number];

export interface VocabularyAttemptRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  vocabularyWordId: Types.ObjectId;
  studySessionId: Types.ObjectId;
  exerciseType: ExerciseType;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  rating: ReviewRating;
  createdAt: Date;
}

const schema = new Schema<VocabularyAttemptRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    vocabularyWordId: {
      type: Schema.Types.ObjectId,
      ref: "VocabularyWord",
      required: true,
      immutable: true,
    },
    studySessionId: {
      type: Schema.Types.ObjectId,
      ref: "StudySession",
      required: true,
    },
    exerciseType: {
      type: String,
      enum: exerciseTypes,
      required: true,
    },
    prompt: { type: String, required: true },
    userAnswer: { type: String, required: true },
    correctAnswer: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    rating: {
      type: String,
      enum: ["AGAIN", "HARD", "GOOD", "EASY"],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ userId: 1, createdAt: -1 });
schema.index({ userId: 1, vocabularyWordId: 1, createdAt: -1 });
schema.index({ userId: 1, isCorrect: 1, createdAt: -1 });
schema.index({ studySessionId: 1 });

export const VocabularyAttempt: Model<VocabularyAttemptRecord> =
  (mongoose.models.VocabularyAttempt as
    Model<VocabularyAttemptRecord> | undefined) ??
  mongoose.model<VocabularyAttemptRecord>("VocabularyAttempt", schema);
