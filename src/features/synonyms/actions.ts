"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import {
  createSynonymGroup,
  updateSynonymGroup,
  deleteSynonymGroup,
  changeSynonymGroupStatus,
  previewSynonymImport,
  confirmSynonymImport,
  SynonymError,
} from "@/services/synonyms";
import type { ActionState } from "@/types/actions";
import type {
  SynonymImportPreview,
  SynonymImportResult,
} from "@/types/synonyms";

export interface SynonymGroupActionState extends ActionState {
  savedId?: string;
}

export interface SynonymImportActionState extends ActionState {
  preview?: SynonymImportPreview;
  result?: SynonymImportResult;
  json?: string;
}

function refreshSynonyms() {
  revalidatePath("/synonyms", "layout");
  revalidatePath("/learn");
  revalidatePath("/dashboard");
}

function actionError(error: unknown): ActionState {
  if (error instanceof ZodError) {
    return {
      error: "Please check the highlighted fields.",
      fields: error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  if (error instanceof SynonymError) {
    return { error: error.message };
  }
  if (error instanceof Error) {
    return { error: error.message };
  }
  return {
    error: "Your synonym notebook couldn’t be updated. Please try again.",
  };
}

export async function saveSynonymGroupAction(
  _state: SynonymGroupActionState,
  form: FormData,
): Promise<SynonymGroupActionState> {
  await requireUser();
  const id = form.get("id");
  let savedId: string;

  const term = form.get("term");
  const meaning = form.get("meaning");
  const notes = form.get("notes");
  const status = form.get("status") || "NEW";
  const synonymsRaw = form.get("synonymsJson");

  let synonyms: Array<{ word: string; example?: string }> = [];
  try {
    if (typeof synonymsRaw === "string" && synonymsRaw.trim()) {
      synonyms = JSON.parse(synonymsRaw);
    }
  } catch {
    return { error: "Invalid synonyms format. Please re-enter." };
  }

  const payload = {
    term,
    meaning,
    notes,
    status,
    synonyms,
  };

  try {
    if (id) {
      await updateSynonymGroup(id, payload);
      savedId = String(id);
    } else {
      savedId = await createSynonymGroup(payload);
    }
  } catch (error) {
    return actionError(error);
  }

  refreshSynonyms();

  if (!id && form.get("afterSave") !== "another") {
    redirect(`/synonyms/${savedId}?saved=1`);
  }

  return {
    success: id ? "Changes saved." : "Synonym group saved. Ready for another.",
    savedId,
  };
}

export async function statusSynonymGroupAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireUser();
  try {
    await changeSynonymGroupStatus(Object.fromEntries(form));
  } catch (error) {
    return actionError(error);
  }
  refreshSynonyms();
  return { success: "Status updated." };
}

export async function deleteSynonymGroupAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireUser();
  if (form.get("confirmed") !== "yes") {
    return { error: "Please confirm deletion first." };
  }
  try {
    await deleteSynonymGroup(form.get("id"));
  } catch (error) {
    return actionError(error);
  }
  refreshSynonyms();
  redirect("/synonyms?deleted=1");
}

export async function importSynonymAction(
  _state: SynonymImportActionState,
  form: FormData,
): Promise<SynonymImportActionState> {
  await requireUser();
  const rawJson = form.get("json");
  if (typeof rawJson !== "string") {
    return { error: "Please paste a JSON array first." };
  }
  const json = rawJson.replace(/\r\n/g, "\n");

  try {
    if (form.get("step") === "confirm") {
      const itemsRaw = form.get("readyItemsJson");
      let readyItems: unknown[] = [];
      if (typeof itemsRaw === "string") {
        readyItems = JSON.parse(itemsRaw);
      }
      const result = await confirmSynonymImport(readyItems);
      refreshSynonyms();
      return {
        result,
        success: `${result.saved} synonym groups imported. ${result.skipped} duplicates/invalid skipped.`,
      };
    }

    const preview = await previewSynonymImport(json);
    return { preview, json };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return {
      error: "The import could not finish. Please review and try again.",
    };
  }
}
