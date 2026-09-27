import { addDays } from "@/lib/dates";

/**
 * Calculates current streak from a set of completed civil dates and today's date.
 * If today has a completed date, streak counts backwards from today.
 * If today does not yet have a completed date, streak remains alive if yesterday was completed.
 */
export function calculateStreakFromDates(
  completedDateKeys: Iterable<string>,
  today: string,
): number {
  const dates = new Set(completedDateKeys);
  const yesterday = addDays(today, -1);

  let checkDay: string;
  if (dates.has(today)) {
    checkDay = today;
  } else if (dates.has(yesterday)) {
    checkDay = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (dates.has(checkDay)) {
    streak += 1;
    checkDay = addDays(checkDay, -1);
  }

  return streak;
}
