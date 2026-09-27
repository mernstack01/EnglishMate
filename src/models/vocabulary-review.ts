import mongoose, { Schema, type Model, type Types } from "mongoose";

export type ReviewRating = "AGAIN" | "HARD" | "GOOD" | "EASY";

export interface VocabularyReviewRecord {
  userId: Types.ObjectId;
  vocabularyWordId: Types.ObjectId;
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

const schema = new Schema<VocabularyReviewRecord>(
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

schema.index({ userId: 1, vocabularyWordId: 1 }, { unique: true });
schema.index({ userId: 1, nextReviewAt: 1 });

export const VocabularyReview: Model<VocabularyReviewRecord> =
  (mongoose.models.VocabularyReview as
    Model<VocabularyReviewRecord> | undefined) ??
  mongoose.model<VocabularyReviewRecord>("VocabularyReview", schema);
