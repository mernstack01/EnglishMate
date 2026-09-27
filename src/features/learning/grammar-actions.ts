"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import {
  startGrammarSession,
  submitGrammarAnswer,
  GrammarLearningError,
} from "@/services/grammar-learning";
import type { ActionState } from "@/types/actions";

function actionError(error: unknown): ActionState {
  if (error instanceof ZodError) {
    return {
      error: "Invalid input.",
      fields: error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  if (error instanceof GrammarLearningError) {
    return { error: error.message };
  }
  if (error instanceof Error) {
    return { error: error.message };
  }
  return { error: "Something went wrong with the session. Please try again." };
}

export async function startGrammarTopicPracticeAction(topicId: string) {
  await requireUser();

  if (!topicId || typeof topicId !== "string") {
    return { error: "Topic ID is missing." };
  }

  let sessionId: string;
  try {
    sessionId = await startGrammarSession("TOPIC", topicId);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/learn");
  revalidatePath("/learn/grammar");
  revalidatePath(`/learn/grammar/${topicId}`);
  redirect(`/learn/grammar/${topicId}/practice?session=${sessionId}`);
}

export async function startGrammarMistakesPracticeAction(topicId?: string) {
  await requireUser();

  let sessionId: string;
  try {
    sessionId = await startGrammarSession("MISTAKES", topicId);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/learn");
  revalidatePath("/learn/grammar");
  revalidatePath("/learn/grammar/mistakes");

  const targetPath = topicId
    ? `/learn/grammar/${topicId}/practice?session=${sessionId}`
    : `/learn/grammar/practice?session=${sessionId}`;

  redirect(targetPath);
}

export async function submitGrammarAnswerAction(
  sessionId: string,
  questionIndex: number,
  answer: string,
  exerciseId?: string,
) {
  await requireUser();

  if (!sessionId || typeof questionIndex !== "number") {
    return { error: "Invalid submission data." };
  }

  try {
    const result = await submitGrammarAnswer(
      sessionId,
      questionIndex,
      answer || "",
      exerciseId,
    );

    if (result.isCompleted) {
      revalidatePath("/learn");
      revalidatePath("/learn/grammar");
      revalidatePath("/dashboard");
      revalidatePath("/progress");
    }

    return { data: result };
  } catch (error) {
    return actionError(error);
  }
}
