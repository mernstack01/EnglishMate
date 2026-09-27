import { z } from "zod";
import { isDateKey } from "@/lib/dates";
import {
  wordStatuses,
  normalizeWord,
  MAX_IMPORT_ROWS,
  MAX_IMPORT_BYTES,
} from "@/features/vocabulary/constants";
const optionalText = (max: number) => z.string().trim().max(max).default("");
export const wordInputSchema = z.object({
  word: z
    .string()
    .trim()
    .min(1, "Enter a word or phrase.")
    .max(120)
    .refine(
      (v) => normalizeWord(v).length > 0 && normalizeWord(v).length <= 120,
      "Use a word or phrase of up to 120 characters.",
    ),
  translation: z.string().trim().min(1, "Enter a translation.").max(500),
  definition: optionalText(2000),
  example: optionalText(2000),
  pronunciation: optionalText(200),
  partOfSpeech: optionalText(80),
  notes: optionalText(4000),
});
export const editWordSchema = wordInputSchema.extend({
  status: z.enum(wordStatuses),
  difficulty: z.coerce.number().int().min(0).max(5).default(0),
});
export const wordIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
export const statusInputSchema = z.object({
  id: wordIdSchema,
  status: z.enum(wordStatuses),
});
export const dateSchema = z
  .string()
  .refine(isDateKey, "Choose a valid date between 1970 and 2100.");
export const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .refine((v) => isDateKey(`${v}-01`), "Choose a valid month.");
export const vocabularyQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["ALL", ...wordStatuses]).default("ALL"),
  date: z.union([dateSchema, z.literal("")]).default(""),
  sort: z.enum(["newest", "oldest", "az", "za"]).default("newest"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export type WordInput = z.infer<typeof wordInputSchema>;
export type VocabularyQuery = z.infer<typeof vocabularyQuerySchema>;
export function parseImport(text: string) {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES)
    throw new Error("Use a JSON file smaller than 256 KB.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(
      "That JSON is not valid. Check commas, quotes, and brackets.",
    );
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.words) && obj.words.length) {
      raw = obj.words;
    } else if (Array.isArray(obj.vocabulary) && obj.vocabulary.length) {
      raw = obj.vocabulary;
    } else if (Array.isArray(obj.data) && obj.data.length) {
      raw = obj.data;
    } else if (
      ("word" in obj || "term" in obj || "en" in obj) &&
      ("translation" in obj ||
        "meaning" in obj ||
        "uz" in obj ||
        "tarjima" in obj)
    ) {
      raw = [obj];
    }
  }
  if (!Array.isArray(raw) || !raw.length)
    throw new Error("Provide a non-empty JSON array of words.");
  if (raw.length > MAX_IMPORT_ROWS)
    throw new Error(`Import up to ${MAX_IMPORT_ROWS} rows at a time.`);
  const seen = new Set<string>();
  return raw.map((value: unknown, index) => {
    let item = value;
    if (typeof value === "object" && value !== null) {
      const rec = { ...(value as Record<string, unknown>) };
      if (!rec.word && (rec.term || rec.en || rec.english)) {
        rec.word = String(rec.term ?? rec.en ?? rec.english);
      }
      if (
        !rec.translation &&
        (rec.meaning || rec.tarjima || rec.uz || rec.uzbek)
      ) {
        rec.translation = String(
          rec.meaning ?? rec.tarjima ?? rec.uz ?? rec.uzbek,
        );
      }
      item = rec;
    }
    const parsed = wordInputSchema.safeParse(item);
    if (!parsed.success)
      return {
        row: index + 1,
        word:
          typeof item === "object" &&
          item !== null &&
          "word" in item &&
          typeof (item as Record<string, unknown>).word === "string"
            ? ((item as Record<string, unknown>).word as string).slice(0, 120)
            : "—",
        kind: "invalid" as const,
        issues: parsed.error.issues
          .map((i) => `${i.path.join(".") || "row"}: ${i.message}`)
          .join("; "),
      };
    const normalized = normalizeWord(parsed.data.word);
    if (seen.has(normalized))
      return {
        row: index + 1,
        word: parsed.data.word,
        translation: parsed.data.translation,
        kind: "duplicate" as const,
        issues: "Repeated inside this import.",
      };
    seen.add(normalized);
    return {
      row: index + 1,
      word: parsed.data.word,
      translation: parsed.data.translation,
      kind: "ready" as const,
      issues: "",
      data: parsed.data,
      normalized,
    };
  });
}
