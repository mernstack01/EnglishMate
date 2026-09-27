"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import {
  analyzeTextbookImage,
  enrichSelectedCandidates,
  autofillWord,
  confirmImageImport,
  AiImportError,
} from "@/services/ai-import";
import { AiConfigurationError, AiServiceError } from "@/lib/ai/provider";
import type {
  ExtractedCandidate,
  CandidateToEnrich,
  EnrichedVocabulary,
} from "@/lib/ai/types";
import { ZodError } from "zod";

function mapAiError(error: unknown): string {
  if (error instanceof AiConfigurationError) {
    return error.message;
  }
  if (error instanceof AiImportError || error instanceof AiServiceError) {
    return error.message;
  }
  if (error instanceof ZodError) {
    return error.issues[0]?.message || "Validation failed for AI request.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred while processing your request.";
}

export type AnalyzeImageActionResult =
  | { success: true; candidates: ExtractedCandidate[] }
  | { success: false; error: string; isConfigError?: boolean };

export async function analyzeImageAction(
  formData: FormData,
): Promise<AnalyzeImageActionResult> {
  try {
    await requireUser();
    const file = formData.get("image");

    if (!file || !(file instanceof Blob)) {
      return {
        success: false,
        error: "Please select an image file to upload.",
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { candidates } = await analyzeTextbookImage(buffer);
    return { success: true, candidates };
  } catch (error) {
    const isConfigError = error instanceof AiConfigurationError;
    return {
      success: false,
      error: mapAiError(error),
      isConfigError,
    };
  }
}

export type EnrichCandidatesActionResult =
  | { success: true; items: EnrichedVocabulary[] }
  | { success: false; error: string };

export async function enrichCandidatesAction(
  candidates: CandidateToEnrich[],
): Promise<EnrichCandidatesActionResult> {
  try {
    await requireUser();
    const { items } = await enrichSelectedCandidates(candidates);
    return { success: true, items };
  } catch (error) {
    return {
      success: false,
      error: mapAiError(error),
    };
  }
}

export type ConfirmImageImportActionResult =
  | {
      success: true;
      importedCount: number;
      skippedDuplicatesCount: number;
      importedWords: Array<{ id: string; word: string; translation: string }>;
    }
  | { success: false; error: string };

export async function confirmImageImportAction(
  words: EnrichedVocabulary[],
): Promise<ConfirmImageImportActionResult> {
  try {
    await requireUser();
    const result = await confirmImageImport({ words });
    revalidatePath("/vocabulary", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/learn");
    return {
      success: true,
      importedCount: result.importedCount,
      skippedDuplicatesCount: result.skippedDuplicatesCount,
      importedWords: result.importedWords,
    };
  } catch (error) {
    return {
      success: false,
      error: mapAiError(error),
    };
  }
}

export type AutofillWordActionResult =
  | { success: true; data: EnrichedVocabulary }
  | { success: false; error: string };

export async function autofillWordAction(
  word: string,
  context?: string,
): Promise<AutofillWordActionResult> {
  try {
    await requireUser();
    const data = await autofillWord(word, context);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: mapAiError(error),
    };
  }
}
