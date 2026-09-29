import mongoose, { Schema, type Model } from "mongoose";
export interface UserRecord {
  name: string;
  email: string;
  passwordHash: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  preferredLanguage: "UZ" | "EN";
  dailyQuestionGoal: 10 | 15 | 20 | 30 | 40;
  createdAt: Date;
  updatedAt: Date;
}
const userSchema = new Schema<UserRecord>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
      required: true,
    },
    isActive: { type: Boolean, default: true, required: true },
    preferredLanguage: {
      type: String,
      enum: ["UZ", "EN"],
      default: "EN",
      required: true,
    },
    dailyQuestionGoal: {
      type: Number,
      enum: [10, 15, 20, 30, 40],
      default: 20,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        Reflect.deleteProperty(ret, "passwordHash");
        return ret;
      },
    },
  },
);
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: -1, _id: -1 });
userSchema.index({ isActive: 1, createdAt: -1, _id: -1 });
export const User: Model<UserRecord> =
  (mongoose.models.User as Model<UserRecord> | undefined) ??
  mongoose.model<UserRecord>("User", userSchema);
