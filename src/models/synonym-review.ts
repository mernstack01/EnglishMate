import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { ReviewRating } from "./vocabulary-review";

export interface SynonymReviewRecord {
  userId: Types.ObjectId;
  synonymGroupId: Types.ObjectId;
  nextReviewAt: Date;
  lastReviewedAt: Date | null;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  correctCount: number;
  incorrectCount: number;
  lastRating: ReviewRating | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<SynonymReviewRecord>(
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
    nextReviewAt: { type: Date, required: true, default: Date.now },
    lastReviewedAt: { type: Date, default: null },
    intervalDays: { type: Number, default: 0, min: 0 },
    easeFactor: { type: Number, default: 2.5, min: 1.3, max: 3.5 },
    repetitions: { type: Number, default: 0, min: 0 },
    correctCount: { type: Number, default: 0, min: 0 },
    incorrectCount: { type: Number, default: 0, min: 0 },
    lastRating: {
      type: String,
      enum: ["AGAIN", "HARD", "GOOD", "EASY"],
      default: null,
    },
  },
  { timestamps: true },
);

schema.index({ userId: 1, synonymGroupId: 1 }, { unique: true });
schema.index({ userId: 1, nextReviewAt: 1 });

export const SynonymReview: Model<SynonymReviewRecord> =
  (mongoose.models.SynonymReview as Model<SynonymReviewRecord> | undefined) ??
  mongoose.model<SynonymReviewRecord>("SynonymReview", schema);
