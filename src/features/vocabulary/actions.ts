"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import {
  createVocabulary,
  updateVocabulary,
  deleteVocabulary,
  changeVocabularyStatus,
  previewVocabularyImport,
  importVocabulary,
  VocabularyError,
} from "@/services/vocabulary";
import type { ActionState } from "@/types/actions";
import type { ImportPreview, ImportResult } from "@/types/vocabulary";
export interface WordActionState extends ActionState {
  savedId?: string;
}
export interface ImportActionState extends ActionState {
  preview?: ImportPreview;
  result?: ImportResult;
  json?: string;
}
function refreshNotebook() {
  revalidatePath("/vocabulary", "layout");
  revalidatePath("/dashboard");
}
function actionError(error: unknown): ActionState {
  if (error instanceof ZodError)
    return {
      error: "Check the highlighted fields.",
      fields: error.flatten().fieldErrors as Record<string, string[]>,
    };
  if (error instanceof VocabularyError) return { error: error.message };
  return { error: "Your notebook couldn’t be updated. Please try again." };
}
export async function saveWordAction(
  _state: WordActionState,
  form: FormData,
): Promise<WordActionState> {
  await requireUser();
  const id = form.get("id");
  let savedId: string;
  try {
    if (id) {
      await updateVocabulary(id, Object.fromEntries(form));
      savedId = String(id);
    } else savedId = await createVocabulary(Object.fromEntries(form));
  } catch (error) {
    return actionError(error);
  }
  refreshNotebook();
  if (!id && form.get("afterSave") !== "another")
    redirect(`/vocabulary/${savedId}?saved=1`);
  return {
    success: id ? "Changes saved." : "Word saved. Ready for the next one.",
    savedId,
  };
}
export async function statusWordAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireUser();
  try {
    await changeVocabularyStatus(Object.fromEntries(form));
  } catch (error) {
    return actionError(error);
  }
  refreshNotebook();
  return { success: "Status updated." };
}
export async function deleteWordAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireUser();
  if (form.get("confirmed") !== "yes")
    return { error: "Confirm deletion first." };
  try {
    await deleteVocabulary(form.get("id"));
  } catch (error) {
    return actionError(error);
  }
  refreshNotebook();
  redirect("/vocabulary?deleted=1");
}
export async function importWordAction(
  _state: ImportActionState,
  form: FormData,
): Promise<ImportActionState> {
  await requireUser();
  const rawJson = form.get("json");
  if (typeof rawJson !== "string")
    return { error: "Paste a JSON array first." };
  const json = rawJson.replace(/\r\n/g, "\n");
  try {
    if (form.get("step") === "confirm") {
      const result = await importVocabulary(json);
      refreshNotebook();
      return {
        result,
        success: `${result.imported} words imported. ${result.skippedDuplicates} duplicates skipped. ${result.invalid} invalid rows skipped.`,
      };
    }
    return { preview: await previewVocabularyImport(json), json };
  } catch (error) {
    if (
      error instanceof Error &&
      /^(Use a JSON|That JSON|Provide a non-empty|Import up to)/.test(
        error.message,
      )
    )
      return { error: error.message };
    return {
      error:
        "The import couldn’t finish. Please preview again before retrying; words already saved will be skipped.",
    };
  }
}
