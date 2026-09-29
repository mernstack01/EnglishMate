import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./config";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/user";
import type { CurrentUser } from "@/types/user";
// Request-scoped cache only. Role and active status are ALWAYS read from MongoDB.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user.id) return null;
  await connectDB();
  const user = await User.findById(session.user.id)
    .select("name email role preferredLanguage dailyQuestionGoal isActive")
    .lean();
  if (!user?.isActive) return null;
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    preferredLanguage: user.preferredLanguage,
    dailyQuestionGoal: (user.dailyQuestionGoal as 10 | 15 | 20 | 30 | 40) || 20,
  };
});
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
