"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import {
  createGrammarTopic,
  updateGrammarTopic,
  deleteGrammarTopic,
  createGrammarExercise,
  updateGrammarExercise,
  deleteGrammarExercise,
  previewGrammarImport,
  confirmGrammarImport,
  GrammarError,
} from "@/services/grammar";
import type { ActionState } from "@/types/actions";
import type { GrammarImportPreview } from "@/types/grammar";
import type { GrammarCategory } from "./constants";

export interface GrammarTopicActionState extends ActionState {
  savedId?: string;
}

export interface GrammarExerciseActionState extends ActionState {
  savedExerciseId?: string;
}

export interface GrammarImportActionState extends ActionState {
  preview?: GrammarImportPreview;
  importedCount?: number;
  importedTopicId?: string;
}

function refreshGrammar(topicId?: string) {
  revalidatePath("/grammar", "layout");
  revalidatePath("/learn");
  revalidatePath("/dashboard");
  revalidatePath("/progress");
  if (topicId) {
    revalidatePath(`/grammar/${topicId}`);
    revalidatePath(`/grammar/${topicId}/exercises`);
  }
}

function actionError(error: unknown): ActionState {
  if (error instanceof ZodError) {
    return {
      error: "Please check the highlighted fields.",
      fields: error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  if (error instanceof GrammarError) {
    return { error: error.message };
  }
  if (error instanceof Error) {
    return { error: error.message };
  }
  return { error: "An unexpected error occurred. Please try again." };
}

export async function saveGrammarTopicAction(
  _prevState: GrammarTopicActionState,
  formData: FormData,
): Promise<GrammarTopicActionState> {
  await requireUser();

  const id = formData.get("id");
  const isEditing = typeof id === "string" && id.length > 0;

  const raw = {
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description") || "",
    content: formData.get("content") || "",
    notes: formData.get("notes") || "",
    ...(isEditing && formData.get("status")
      ? { status: formData.get("status") }
      : {}),
  };

  let savedId: string;
  try {
    if (isEditing) {
      const updated = await updateGrammarTopic(id, raw);
      savedId = updated.id;
    } else {
      const created = await createGrammarTopic(raw);
      savedId = created.id;
    }
  } catch (error) {
    return actionError(error);
  }

  refreshGrammar(savedId);

  const afterSave = formData.get("afterSave");
  if (afterSave === "exercise") {
    redirect(`/grammar/${savedId}/exercises/new`);
  } else if (afterSave === "another") {
    return {
      success: `Topic saved successfully!`,
      savedId,
    };
  }

  redirect(`/grammar/${savedId}?saved=1`);
}

export async function deleteGrammarTopicAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const id = formData.get("id");
  if (typeof id !== "string" || !id.trim()) {
    return { error: "Topic ID is missing." };
  }

  try {
    await deleteGrammarTopic(id);
  } catch (error) {
    return actionError(error);
  }

  refreshGrammar();
  redirect("/grammar");
}

export async function saveGrammarExerciseAction(
  _prevState: GrammarExerciseActionState,
  formData: FormData,
): Promise<GrammarExerciseActionState> {
  await requireUser();

  const topicId = formData.get("topicId");
  const exerciseId = formData.get("exerciseId");
  const isEditing = typeof exerciseId === "string" && exerciseId.length > 0;

  if (typeof topicId !== "string" || !topicId.trim()) {
    return { error: "Topic ID is missing." };
  }

  // Parse options for Multiple Choice
  let options: string[] = [];
  const rawOptions = formData.get("optionsJson");
  if (typeof rawOptions === "string" && rawOptions.trim()) {
    try {
      options = JSON.parse(rawOptions);
    } catch {
      options = [];
    }
  } else {
    const rawLines = formData.get("options");
    if (typeof rawLines === "string") {
      options = rawLines
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  // Parse accepted answers
  let acceptedAnswers: string[] = [];
  const rawAccepted = formData.get("acceptedAnswersJson");
  if (typeof rawAccepted === "string" && rawAccepted.trim()) {
    try {
      acceptedAnswers = JSON.parse(rawAccepted);
    } catch {
      acceptedAnswers = [];
    }
  } else {
    const rawAcceptedText = formData.get("acceptedAnswers");
    if (typeof rawAcceptedText === "string") {
      acceptedAnswers = rawAcceptedText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const raw = {
    type: formData.get("type"),
    question: formData.get("question"),
    options,
    correctAnswer: formData.get("correctAnswer"),
    acceptedAnswers,
    explanation: formData.get("explanation") || "",
    difficulty: formData.get("difficulty") || 2,
    order: formData.get("order") || 0,
    isActive: formData.get("isActive") !== "false",
  };

  let savedExerciseId: string;
  try {
    if (isEditing) {
      const updated = await updateGrammarExercise(exerciseId, raw);
      savedExerciseId = updated.id;
    } else {
      const created = await createGrammarExercise(topicId, raw);
      savedExerciseId = created.id;
    }
  } catch (error) {
    return actionError(error);
  }

  refreshGrammar(topicId);

  const afterSave = formData.get("afterSave");
  if (afterSave === "another") {
    return {
      success: "Exercise saved! You can add another below.",
      savedExerciseId,
    };
  }

  redirect(`/grammar/${topicId}`);
}

export async function deleteGrammarExerciseAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const topicId = formData.get("topicId");
  const exerciseId = formData.get("exerciseId");

  if (typeof exerciseId !== "string" || !exerciseId.trim()) {
    return { error: "Exercise ID is missing." };
  }

  try {
    await deleteGrammarExercise(exerciseId);
  } catch (error) {
    return actionError(error);
  }

  if (typeof topicId === "string") {
    refreshGrammar(topicId);
  } else {
    refreshGrammar();
  }

  return { success: "Exercise deleted." };
}

export async function importGrammarAction(
  _prevState: GrammarImportActionState,
  formData: FormData,
): Promise<GrammarImportActionState> {
  await requireUser();

  const step = formData.get("step") || "preview";
  const targetTopicId = formData.get("targetTopicId") as string | null;

  if (step === "confirm") {
    const title = (formData.get("title") as string) || "Imported Grammar Topic";
    const category = ((formData.get("category") as string) ||
      "OTHER") as GrammarCategory;
    const description = (formData.get("description") as string) || "";
    const content = (formData.get("content") as string) || "";
    const notes = (formData.get("notes") as string) || "";
    const readyExercisesJson = formData.get("readyExercisesJson") as string;

    if (!readyExercisesJson) {
      return { error: "No exercises ready for import." };
    }

    let exercises: Array<{
      type: string;
      question: string;
      options: string[];
      correctAnswer: string;
      acceptedAnswers: string[];
      explanation?: string;
      difficulty?: number;
    }> = [];
    try {
      exercises = JSON.parse(readyExercisesJson);
    } catch {
      return { error: "Malformed exercises payload." };
    }

    try {
      const result = await confirmGrammarImport({
        mode: targetTopicId ? "EXISTING_TOPIC" : "NEW_TOPIC",
        targetTopicId: targetTopicId || undefined,
        title,
        category,
        description,
        content,
        notes,
        exercises,
      });

      refreshGrammar(result.topicId);

      return {
        success: `Successfully imported ${result.importedCount} exercise(s)!`,
        importedCount: result.importedCount,
        importedTopicId: result.topicId,
      };
    } catch (error) {
      return actionError(error);
    }
  }

  // Step === "preview"
  const rawJson = formData.get("json");
  if (typeof rawJson !== "string" || !rawJson.trim()) {
    return { error: "Please paste your grammar JSON content." };
  }

  try {
    const preview = await previewGrammarImport(
      rawJson,
      targetTopicId || undefined,
    );
    return { preview };
  } catch (error) {
    return actionError(error);
  }
}
