import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { ReviewRating } from "./vocabulary-review";

export const synonymExerciseTypes = [
  "RECOGNITION",
  "REVERSE_RECOGNITION",
  "MULTI_ANSWER",
  "TYPING",
  "MATCH",
] as const;

export type SynonymExerciseType = (typeof synonymExerciseTypes)[number];

export interface SynonymAttemptRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  synonymGroupId: Types.ObjectId;
  studySessionId: Types.ObjectId;
  exerciseType: SynonymExerciseType;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  rating: ReviewRating;
  createdAt: Date;
}

const schema = new Schema<SynonymAttemptRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    synonymGroupId: {
      type: Schema.Types.ObjectId,
      ref: "SynonymGroup",
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
      enum: synonymExerciseTypes,
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
schema.index({ userId: 1, synonymGroupId: 1, createdAt: -1 });
schema.index({ userId: 1, isCorrect: 1, createdAt: -1 });
schema.index({ studySessionId: 1 });

export const SynonymAttempt: Model<SynonymAttemptRecord> =
  (mongoose.models.SynonymAttempt as Model<SynonymAttemptRecord> | undefined) ??
  mongoose.model<SynonymAttemptRecord>("SynonymAttempt", schema);
