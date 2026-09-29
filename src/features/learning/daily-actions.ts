"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import {
  startDailySession,
  submitDailyAnswer,
  DailyLearningError,
} from "@/services/daily-learning";
import {
  startMistakesPracticeSession,
  MistakesError,
} from "@/services/mistakes";
import type { MistakeTabFilter } from "@/types/mistakes";

const submitDailyAnswerSchema = z.object({
  sessionId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid session ID."),
  sessionItemId: z.string().min(1, "Session item ID is required."),
  userAnswer: z.string().default(""),
  activeSeconds: z.number().int().min(1).max(300).default(5),
});

export async function startDailySessionAction(options?: {
  forceNew?: boolean;
}) {
  await requireUser();

  let sessionId: string;
  try {
    sessionId = await startDailySession(undefined, {
      forceNew: options?.forceNew,
    });
  } catch (error) {
    if (error instanceof DailyLearningError) {
      return { error: error.message };
    }
    return { error: "Failed to start daily learning session." };
  }

  revalidatePath("/learn");
  revalidatePath("/learn/today");
  revalidatePath("/dashboard");
  redirect(`/learn/today/practice?sessionId=${sessionId}`);
}

export async function submitDailyAnswerAction(
  sessionId: string,
  sessionItemId: string,
  userAnswer: string,
  activeSeconds: number = 5,
) {
  await requireUser();

  const parsed = submitDailyAnswerSchema.safeParse({
    sessionId,
    sessionItemId,
    userAnswer,
    activeSeconds,
  });

  if (!parsed.success) {
    return { error: "Invalid submission data." };
  }

  try {
    const result = await submitDailyAnswer(
      parsed.data.sessionId,
      parsed.data.sessionItemId,
      parsed.data.userAnswer,
      parsed.data.activeSeconds,
    );

    if (result.isCompleted) {
      revalidatePath("/learn");
      revalidatePath("/learn/today");
      revalidatePath("/dashboard");
      revalidatePath("/progress");
      revalidatePath("/mistakes");
    }

    return { data: result };
  } catch (error) {
    if (error instanceof DailyLearningError) {
      return { error: error.message };
    }
    return { error: "Failed to evaluate answer." };
  }
}

export async function startMistakesPracticeAction(
  moduleFilter: MistakeTabFilter = "ALL",
) {
  await requireUser();

  let sessionId: string;
  try {
    sessionId = await startMistakesPracticeSession(moduleFilter);
  } catch (error) {
    if (error instanceof MistakesError) {
      return { error: error.message };
    }
    return { error: "Failed to start mistakes practice session." };
  }

  revalidatePath("/mistakes");
  revalidatePath("/learn");
  redirect(`/learn/today/practice?sessionId=${sessionId}`);
}
