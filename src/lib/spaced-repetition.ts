import type { ReviewRating } from "@/models/vocabulary-review";
import type { WordStatus } from "@/features/vocabulary/constants";

export interface ReviewScheduleInput {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  correctCount: number;
  incorrectCount: number;
}

export interface ReviewScheduleResult {
  nextReviewAt: Date;
  lastReviewedAt: Date;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  correctCount: number;
  incorrectCount: number;
  lastRating: ReviewRating;
}

export const MIN_EASE_FACTOR = 1.3;
export const MAX_EASE_FACTOR = 3.0;
export const DEFAULT_EASE_FACTOR = 2.5;

/**
 * Deterministic SM-2-inspired spaced repetition scheduler.
 */
export function calculateNextReview(
  current: ReviewScheduleInput,
  rating: ReviewRating,
  now: Date = new Date(),
): ReviewScheduleResult {
  const currentEase = current.easeFactor || DEFAULT_EASE_FACTOR;
  let intervalDays = 0;
  let repetitions = 0;
  let easeFactor = currentEase;
  let correctCount = current.correctCount || 0;
  let incorrectCount = current.incorrectCount || 0;
  let nextReviewAt: Date;

  switch (rating) {
    case "AGAIN": {
      repetitions = 0;
      intervalDays = 0;
      easeFactor = Math.max(MIN_EASE_FACTOR, currentEase - 0.2);
      incorrectCount += 1;
      // Scheduled for immediate review (10 minutes from now)
      nextReviewAt = new Date(now.getTime() + 10 * 60 * 1000);
      break;
    }
    case "HARD": {
      repetitions = (current.repetitions || 0) + 1;
      correctCount += 1;
      easeFactor = Math.max(MIN_EASE_FACTOR, currentEase - 0.15);
      if (repetitions <= 1) {
        intervalDays = 1;
      } else {
        intervalDays = Math.max(
          1,
          Math.round((current.intervalDays || 1) * 1.2),
        );
      }
      nextReviewAt = new Date(
        now.getTime() + intervalDays * 24 * 60 * 60 * 1000,
      );
      break;
    }
    case "GOOD": {
      repetitions = (current.repetitions || 0) + 1;
      correctCount += 1;
      easeFactor = currentEase;
      if (repetitions === 1) {
        intervalDays = 1;
      } else if (repetitions === 2) {
        intervalDays = 3;
      } else if (repetitions === 3) {
        intervalDays = 7;
      } else if (repetitions === 4) {
        intervalDays = 14;
      } else if (repetitions === 5) {
        intervalDays = 30;
      } else {
        intervalDays = Math.round((current.intervalDays || 30) * easeFactor);
      }
      nextReviewAt = new Date(
        now.getTime() + intervalDays * 24 * 60 * 60 * 1000,
      );
      break;
    }
    case "EASY": {
      repetitions = (current.repetitions || 0) + 1;
      correctCount += 1;
      easeFactor = Math.min(MAX_EASE_FACTOR, currentEase + 0.15);
      if (repetitions === 1) {
        intervalDays = 4;
      } else if (repetitions === 2) {
        intervalDays = 7;
      } else if (repetitions === 3) {
        intervalDays = 14;
      } else {
        intervalDays = Math.round(
          Math.max(14, current.intervalDays || 7) * easeFactor * 1.3,
        );
      }
      nextReviewAt = new Date(
        now.getTime() + intervalDays * 24 * 60 * 60 * 1000,
      );
      break;
    }
  }

  return {
    nextReviewAt,
    lastReviewedAt: now,
    intervalDays,
    easeFactor: Number(easeFactor.toFixed(2)),
    repetitions,
    correctCount,
    incorrectCount,
    lastRating: rating,
  };
}

/**
 * Determine word status progression based on review rating and history.
 */
export function calculateNextWordStatus(
  currentStatus: WordStatus,
  rating: ReviewRating,
  reviewResult: { repetitions: number; incorrectCount: number },
  recentFailuresInSession: number = 0,
): WordStatus {
  if (rating === "AGAIN") {
    if (reviewResult.incorrectCount >= 3 || recentFailuresInSession >= 2) {
      return "DIFFICULT";
    }
    if (currentStatus === "NEW") {
      return "LEARNING";
    }
    return currentStatus;
  }

  if (rating === "GOOD" || rating === "EASY") {
    if (currentStatus === "DIFFICULT") {
      // If repeatedly answered correctly after being difficult, move back to LEARNING
      return reviewResult.repetitions >= 2 ? "LEARNING" : "DIFFICULT";
    }
    if (currentStatus === "NEW") {
      return "LEARNING";
    }
    if (currentStatus === "LEARNING") {
      if (reviewResult.repetitions >= 4) {
        return "LEARNED";
      }
      return "LEARNING";
    }
    return currentStatus;
  }

  // rating === "HARD"
  if (currentStatus === "NEW") {
    return "LEARNING";
  }
  return currentStatus;
}
