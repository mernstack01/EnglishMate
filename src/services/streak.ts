import "server-only";
import { StudySession } from "@/models/study-session";
import { dateKey } from "@/lib/dates";
import { vocabularyTimezone } from "@/lib/vocabulary-timezone";
import { calculateStreakFromDates } from "@/lib/streak";
import type { Types } from "mongoose";

/**
 * Calculates the current consecutive study streak in days based on completed sessions.
 */
export async function calculateUserStreak(
  userId: Types.ObjectId,
  timezone: string = vocabularyTimezone(),
): Promise<number> {
  const sessions = await StudySession.find({
    userId,
    completedAt: { $ne: null },
  })
    .select("completedAt")
    .lean();

  if (!sessions.length) return 0;

  const completedDates = new Set<string>();
  for (const s of sessions) {
    if (s.completedAt) {
      completedDates.add(dateKey(s.completedAt, timezone));
    }
  }

  const today = dateKey(new Date(), timezone);
  return calculateStreakFromDates(completedDates, today);
}
