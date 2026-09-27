import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  grammarCategories,
  grammarStatuses,
  normalizeGrammarTitle,
  type GrammarCategory,
  type GrammarStatus,
} from "@/features/grammar/constants";

export interface GrammarTopicRecord {
  userId: Types.ObjectId;
  title: string;
  normalizedTitle: string;
  category: GrammarCategory;
  description: string;
  content: string;
  notes: string;
  status: GrammarStatus;
  exerciseCount: number;
  attemptsCount: number;
  correctCount: number;
  accuracy: number;
  lastPracticedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<GrammarTopicRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    normalizedTitle: {
      type: String,
      required: true,
      maxlength: 160,
    },
    category: {
      type: String,
      enum: grammarCategories,
      required: true,
      default: "OTHER",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    content: {
      type: String,
      trim: true,
      maxlength: 20000,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    status: {
      type: String,
      enum: grammarStatuses,
      required: true,
      default: "NEW",
    },
    exerciseCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    attemptsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    correctCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    accuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lastPracticedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

schema.pre("validate", function () {
  if (this.title) {
    this.normalizedTitle = normalizeGrammarTitle(this.title);
  }
});

schema.index({ userId: 1, normalizedTitle: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ userId: 1, status: 1 });
schema.index({ userId: 1, category: 1 });

export const GrammarTopic: Model<GrammarTopicRecord> =
  (mongoose.models.GrammarTopic as Model<GrammarTopicRecord> | undefined) ??
  mongoose.model<GrammarTopicRecord>("GrammarTopic", schema);
