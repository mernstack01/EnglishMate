import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  normalizeSynonymTerm,
  synonymSources,
  synonymStatuses,
  type SynonymSource,
  type SynonymStatus,
} from "@/features/synonyms/constants";
import type { ReviewState } from "./vocabulary-word";

export interface SynonymEntry {
  word: string;
  normalizedWord: string;
  example: string;
}

export interface SynonymGroupRecord {
  userId: Types.ObjectId;
  term: string;
  normalizedTerm: string;
  meaning: string;
  notes: string;
  status: SynonymStatus;
  source: SynonymSource;
  synonyms: SynonymEntry[];
  review: ReviewState;
  createdAt: Date;
  updatedAt: Date;
}

const synonymEntrySchema = new Schema<SynonymEntry>(
  {
    word: { type: String, required: true, trim: true, maxlength: 120 },
    normalizedWord: { type: String, required: true, maxlength: 120 },
    example: { type: String, trim: true, maxlength: 2000, default: "" },
  },
  { _id: false },
);

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

const schema = new Schema<SynonymGroupRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    term: { type: String, required: true, trim: true, maxlength: 120 },
    normalizedTerm: { type: String, required: true, maxlength: 120 },
    meaning: { type: String, trim: true, maxlength: 500, default: "" },
    notes: { type: String, trim: true, maxlength: 4000, default: "" },
    status: {
      type: String,
      enum: synonymStatuses,
      required: true,
      default: "NEW",
    },
    source: {
      type: String,
      enum: synonymSources,
      required: true,
      default: "MANUAL",
      immutable: true,
    },
    synonyms: {
      type: [synonymEntrySchema],
      required: true,
      validate: {
        validator: (v: SynonymEntry[]) => Array.isArray(v) && v.length > 0,
        message: "At least one synonym is required.",
      },
    },
    review: { type: reviewSchema, required: true, default: () => ({}) },
  },
  { timestamps: true },
);

schema.pre("validate", function () {
  this.normalizedTerm = normalizeSynonymTerm(this.term || "");
  if (Array.isArray(this.synonyms)) {
    this.synonyms.forEach((item) => {
      item.normalizedWord = normalizeSynonymTerm(item.word || "");
    });
  }
});

schema.index({ userId: 1, normalizedTerm: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1, _id: -1 });
schema.index({ userId: 1, status: 1, createdAt: -1, _id: -1 });
schema.index({ userId: 1, "review.nextReviewAt": 1, status: 1 });
schema.index({ userId: 1, "synonyms.normalizedWord": 1 });

export const SynonymGroup: Model<SynonymGroupRecord> =
  (mongoose.models.SynonymGroup as Model<SynonymGroupRecord> | undefined) ??
  mongoose.model<SynonymGroupRecord>("SynonymGroup", schema);
