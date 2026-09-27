"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import {
  startStudySession,
  submitSessionAnswer,
  LearningError,
} from "@/services/learning";
import { startSessionSchema, submitAnswerSchema } from "@/validations/learning";
import type { ReviewRating } from "@/models/vocabulary-review";
import type { ActionState } from "@/types/actions";

function actionError(error: unknown): ActionState {
  if (error instanceof ZodError) {
    return {
      error: "Invalid input.",
      fields: error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  if (error instanceof LearningError) {
    return { error: error.message };
  }
  return { error: "Something went wrong with the session. Please try again." };
}

export async function startLearningAction(
  type: string = "DAILY",
): Promise<ActionState & { sessionId?: string }> {
  await requireUser();
  const parsed = startSessionSchema.safeParse({ type });
  if (!parsed.success) {
    return actionError(parsed.error);
  }

  let sessionId: string;
  try {
    sessionId = await startStudySession(parsed.data.type);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/learn");
  revalidatePath("/dashboard");
  redirect(`/learn/vocabulary/review?session=${sessionId}`);
}

export async function submitAnswerAction(
  sessionId: string,
  questionIndex: number,
  userAnswer: string,
  rating?: ReviewRating,
) {
  await requireUser();
  const parsed = submitAnswerSchema.safeParse({
    sessionId,
    questionIndex,
    userAnswer,
    rating,
  });

  if (!parsed.success) {
    return { error: "Invalid submission data." };
  }

  try {
    const result = await submitSessionAnswer(
      parsed.data.sessionId,
      parsed.data.questionIndex,
      parsed.data.userAnswer,
      parsed.data.rating,
    );
    if (result.isCompleted) {
      revalidatePath("/learn");
      revalidatePath("/dashboard");
    }
    return { data: result };
  } catch (error) {
    return actionError(error);
  }
}
