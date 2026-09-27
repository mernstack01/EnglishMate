import "server-only";
import { Schema, Types } from "mongoose";
import { requireUser } from "@/lib/auth/current-user";
export const userOwnershipFields = {
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    immutable: true,
  },
};
// Future models: schema.add(userOwnershipFields); schema.index(userOwnershipIndex).
export const userOwnershipIndex = { userId: 1, createdAt: -1 } as const;
// No caller-provided userId or arbitrary filter; use this for reads, updates AND deletes.
export async function ownedScope() {
  const currentUser = await requireUser();
  return { userId: new Types.ObjectId(currentUser.id) };
}
export async function ownedDocumentScope(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new Error("Invalid document ID.");
  return { ...(await ownedScope()), _id: new Types.ObjectId(id) };
}
