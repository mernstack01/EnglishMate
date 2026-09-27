import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface AiUsageRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  operation: "IMAGE_EXTRACTION" | "VOCABULARY_ENRICHMENT" | "SINGLE_AUTOFILL";
  provider?: "OPENAI" | "GEMINI" | "MOCK";
  model: string;
  success: boolean;
  itemCount: number;
  errorMessage?: string;
  createdAt: Date;
}

const schema = new Schema<AiUsageRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    operation: {
      type: String,
      enum: ["IMAGE_EXTRACTION", "VOCABULARY_ENRICHMENT", "SINGLE_AUTOFILL"],
      required: true,
    },
    provider: {
      type: String,
      enum: ["OPENAI", "GEMINI", "MOCK"],
      default: "OPENAI",
    },
    model: { type: String, required: true },
    success: { type: Boolean, required: true },
    itemCount: { type: Number, default: 0 },
    errorMessage: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ userId: 1, createdAt: -1 });

export const AiUsage: Model<AiUsageRecord> =
  (mongoose.models.AiUsage as Model<AiUsageRecord> | undefined) ??
  mongoose.model<AiUsageRecord>("AiUsage", schema);
