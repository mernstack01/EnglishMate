import { z } from "zod";
import { normalizeWord } from "@/features/vocabulary/constants";

export const scannedWordItemSchema = z.object({
  word: z
    .string()
    .trim()
    .min(1, "Word cannot be empty.")
    .max(120, "Word must be 120 characters or fewer.")
    .refine((val) => normalizeWord(val).length > 0, "Invalid word."),
  translation: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(4000).default("Imported from textbook scan"),
});

export const importScannedWordsSchema = z.object({
  words: z
    .array(scannedWordItemSchema)
    .min(1, "Select at least one word to import.")
    .max(100, "You can import up to 100 words at a time."),
});

export type ScannedWordItem = z.infer<typeof scannedWordItemSchema>;
export type ImportScannedWordsInput = z.infer<typeof importScannedWordsSchema>;
