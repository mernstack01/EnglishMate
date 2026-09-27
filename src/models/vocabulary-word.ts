import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  normalizeWord,
  wordSources,
  wordStatuses,
} from "../features/vocabulary/constants";
// Embedded one-to-one review state guarantees atomic creation/deletion, including
// on standalone MongoDB. Phase 3 can evolve this without orphan cleanup jobs.
export interface ReviewState {
  nextReviewAt: Date;
  lastReviewedAt: Date | null;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  correctCount: number;
  incorrectCount: number;
}
export interface VocabularyRecord {
  userId: Types.ObjectId;
  word: string;
  normalizedWord: string;
  translation: string;
  definition: string;
  example: string;
  pronunciation: string;
  partOfSpeech: string;
  notes: string;
  status: (typeof wordStatuses)[number];
  source: (typeof wordSources)[number];
  difficulty: number;
  review: ReviewState;
  createdAt: Date;
  updatedAt: Date;
}
const reviewSchema = new Schema<ReviewState>(
  {
    nextReviewAt: { type: Date, required: true, default: Date.now },
    lastReviewedAt: { type: Date, default: null },
    intervalDays: { type: Number, default: 0, min: 0 },
    easeFactor: { type: Number, default: 2.5, min: 1.3 },
    repetitions: { type: Number, default: 0, min: 0 },
    correctCount: { type: Number, default: 0, min: 0 },
    incorrectCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);
const optionalText = (maxlength: number) => ({
  type: String,
  trim: true,
  maxlength,
  default: "",
});
const schema = new Schema<VocabularyRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    word: { type: String, required: true, trim: true, maxlength: 120 },
    normalizedWord: { type: String, required: true, maxlength: 120 },
    translation: { type: String, required: true, trim: true, maxlength: 500 },
    definition: optionalText(2000),
    example: optionalText(2000),
    pronunciation: optionalText(200),
    partOfSpeech: optionalText(80),
    notes: optionalText(4000),
    status: {
      type: String,
      enum: wordStatuses,
      required: true,
      default: "NEW",
    },
    source: {
      type: String,
      enum: wordSources,
      required: true,
      default: "MANUAL",
      immutable: true,
    },
    difficulty: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
      validate: Number.isInteger,
    },
    review: { type: reviewSchema, required: true, default: () => ({}) },
  },
  { timestamps: true },
);
schema.pre("validate", function () {
  this.normalizedWord = normalizeWord(this.word || "");
});
schema.index({ userId: 1, normalizedWord: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1, _id: -1 });
schema.index({ userId: 1, status: 1, createdAt: -1, _id: -1 });
schema.index({ userId: 1, "review.nextReviewAt": 1, status: 1 });
export const VocabularyWord: Model<VocabularyRecord> =
  (mongoose.models.VocabularyWord as Model<VocabularyRecord> | undefined) ??
  mongoose.model<VocabularyRecord>("VocabularyWord", schema);
