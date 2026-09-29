"use server";

import { revalidatePath } from "next/cache";
import { importScannedWords } from "@/services/scanner";
import type { ImportScannedWordsResult } from "./types";

export type ImportScannedWordsActionResult =
  | { success: true; data: ImportScannedWordsResult }
  | { success: false; error: string };

export async function importScannedWordsAction(
  payload: unknown,
): Promise<ImportScannedWordsActionResult> {
  try {
    const result = await importScannedWords(payload);
    revalidatePath("/vocabulary");
    revalidatePath("/vocabulary/today");
    return { success: true, data: result };
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to import words into your notebook.";
    return {
      success: false,
      error: message,
    };
  }
}
