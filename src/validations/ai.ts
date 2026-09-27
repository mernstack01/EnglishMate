import { z } from "zod";
import { markingTypes } from "@/lib/ai/types";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const rawCandidateAiSchema = z.object({
  word: z.string().trim().min(1).max(120),
  confidence: z.coerce.number().min(0).max(1).default(0.9),
  markingType: z
    .string()
    .transform((val) => {
      const upper = val.toUpperCase().replace(/\s+/g, "_");
      if ((markingTypes as readonly string[]).includes(upper)) {
        return upper as (typeof markingTypes)[number];
      }
      return "OTHER";
    })
    .default("OTHER"),
  context: z.string().trim().max(1000).default(""),
});

export const rawExtractionResponseSchema = z.object({
  candidates: z.array(rawCandidateAiSchema).default([]),
});

export const rawEnrichedAiItemSchema = z.object({
  id: z.string().optional(),
  word: z.string().trim().min(1).max(120),
  translation: z.string().trim().min(1, "Translation is required").max(500),
  definition: z.string().trim().max(2000).default(""),
  example: z.string().trim().max(2000).default(""),
  partOfSpeech: z.string().trim().max(80).default(""),
  pronunciation: z.string().trim().max(200).default(""),
  synonyms: z
    .array(z.string().trim().max(80))
    .or(
      z.string().transform((s) =>
        s
          .split(/[,;\n]/)
          .map((w) => w.trim())
          .filter(Boolean),
      ),
    )
    .default([]),
});

export const rawEnrichmentResponseSchema = z.object({
  items: z.array(rawEnrichedAiItemSchema).default([]),
});

// User action validation schemas
export const candidateToEnrichSchema = z.object({
  id: z.string().min(1),
  word: z.string().trim().min(1).max(120),
  context: z.string().trim().max(1000).optional(),
});

export const enrichSelectionSchema = z.object({
  candidates: z
    .array(candidateToEnrichSchema)
    .min(1, "Select at least one candidate to prepare.")
    .max(50, "You can prepare up to 50 words at once."),
});

export const confirmedImportWordSchema = z.object({
  id: z.string().min(1),
  word: z.string().trim().min(1).max(120),
  translation: z.string().trim().min(1).max(500),
  definition: z.string().trim().max(2000).default(""),
  example: z.string().trim().max(2000).default(""),
  partOfSpeech: z.string().trim().max(80).default(""),
  pronunciation: z.string().trim().max(200).default(""),
  synonyms: z.array(z.string().trim().max(80)).default([]),
});

export const confirmImageImportSchema = z.object({
  words: z
    .array(confirmedImportWordSchema)
    .min(1, "No valid words provided to save.")
    .max(50, "You can import up to 50 words at a time."),
});
