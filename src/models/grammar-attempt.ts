import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface GrammarAttemptRecord {
  userId: Types.ObjectId;
  grammarTopicId: Types.ObjectId;
  grammarExerciseId: Types.ObjectId;
  studySessionId: Types.ObjectId | null;
  exerciseType: string;
  prompt: string;
  userAnswer: string;
  normalizedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  createdAt: Date;
}

const schema = new Schema<GrammarAttemptRecord>(
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
    grammarExerciseId: {
      type: Schema.Types.ObjectId,
      ref: "GrammarExercise",
      required: true,
    },
    studySessionId: {
      type: Schema.Types.ObjectId,
      ref: "StudySession",
      default: null,
    },
    exerciseType: {
      type: String,
      required: true,
    },
    prompt: {
      type: String,
      required: true,
    },
    userAnswer: {
      type: String,
      required: true,
    },
    normalizedAnswer: {
      type: String,
      required: true,
    },
    correctAnswer: {
      type: String,
      required: true,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  { timestamps: false },
);

schema.index({ userId: 1, grammarTopicId: 1, createdAt: -1 });
schema.index({ userId: 1, isCorrect: 1, createdAt: -1 });
schema.index({ userId: 1, grammarExerciseId: 1 });
schema.index({ studySessionId: 1 });

export const GrammarAttempt: Model<GrammarAttemptRecord> =
  (mongoose.models.GrammarAttempt as Model<GrammarAttemptRecord> | undefined) ??
  mongoose.model<GrammarAttemptRecord>("GrammarAttempt", schema);
