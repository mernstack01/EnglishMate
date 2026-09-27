import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  grammarExerciseTypes,
  type GrammarExerciseType,
} from "@/features/grammar/constants";

export interface GrammarExerciseRecord {
  userId: Types.ObjectId;
  grammarTopicId: Types.ObjectId;
  type: GrammarExerciseType;
  question: string;
  options: string[];
  correctAnswer: string;
  acceptedAnswers: string[];
  explanation: string;
  difficulty: number;
  order: number;
  isActive: boolean;
  attemptCount: number;
  correctCount: number;
  incorrectCount: number;
  lastAttemptAt: Date | null;
  lastIsCorrect: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<GrammarExerciseRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    grammarTopicId: {
      type: Schema.Types.ObjectId,
      ref: "GrammarTopic",
      required: true,
    },
    type: {
      type: String,
      enum: grammarExerciseTypes,
      required: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    options: {
      type: [String],
      default: [],
    },
    correctAnswer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    acceptedAnswers: {
      type: [String],
      default: [],
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    difficulty: {
      type: Number,
      min: 1,
      max: 5,
      default: 2,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    correctCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    incorrectCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    lastIsCorrect: {
      type: Boolean,
      default: null,
    },
  },
  { timestamps: true },
);

schema.index({ userId: 1, grammarTopicId: 1, order: 1 });
schema.index({ userId: 1, grammarTopicId: 1, isActive: 1 });
schema.index({ userId: 1, grammarTopicId: 1, lastAttemptAt: 1 });
schema.index({ userId: 1, lastAttemptAt: -1 });

export const GrammarExercise: Model<GrammarExerciseRecord> =
  (mongoose.models.GrammarExercise as
    Model<GrammarExerciseRecord> | undefined) ??
  mongoose.model<GrammarExerciseRecord>("GrammarExercise", schema);
