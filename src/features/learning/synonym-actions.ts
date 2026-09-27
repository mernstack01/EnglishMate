"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import {
  startSynonymSession,
  submitSynonymSessionAnswer,
  SynonymLearningError,
} from "@/services/synonym-learning";
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
  if (error instanceof SynonymLearningError) {
    return { error: error.message };
  }
  return { error: "Something went wrong with the session. Please try again." };
}

export async function startSynonymSessionAction(
  type: string = "DAILY",
): Promise<ActionState & { sessionId?: string }> {
  await requireUser();
  const parsed = startSessionSchema.safeParse({ type });
  if (!parsed.success) {
    return actionError(parsed.error);
  }

  let sessionId: string;
  try {
    sessionId = await startSynonymSession(parsed.data.type);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/learn");
  revalidatePath("/learn/synonyms");
  revalidatePath("/dashboard");
  redirect(`/learn/synonyms/review?session=${sessionId}`);
}

export async function submitSynonymAnswerAction(
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
    const result = await submitSynonymSessionAnswer(
      parsed.data.sessionId,
      parsed.data.questionIndex,
      parsed.data.userAnswer,
      parsed.data.rating,
    );
    if (result.isCompleted) {
      revalidatePath("/learn");
      revalidatePath("/learn/synonyms");
      revalidatePath("/dashboard");
    }
    return { data: result };
  } catch (error) {
    return actionError(error);
  }
}
