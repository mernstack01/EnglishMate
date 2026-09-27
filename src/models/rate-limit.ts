import mongoose, { Schema, type Model } from "mongoose";
interface Record {
  _id: string;
  count: number;
  expiresAt: Date;
}
const schema = new Schema<Record>({
  _id: { type: String, required: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RateLimit: Model<Record> =
  (mongoose.models.RateLimit as Model<Record> | undefined) ??
  mongoose.model<Record>("RateLimit", schema);
