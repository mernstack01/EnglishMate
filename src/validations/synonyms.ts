import { z } from "zod";
import { isDateKey } from "@/lib/dates";
import {
  synonymStatuses,
  normalizeSynonymTerm,
  MAX_SYNONYM_IMPORT_ROWS,
  MAX_SYNONYM_IMPORT_BYTES,
} from "@/features/synonyms/constants";

const optionalText = (max: number) => z.string().trim().max(max).default("");

export const synonymItemSchema = z.object({
  word: z
    .string()
    .trim()
    .min(1, "Enter a synonym.")
    .max(120, "Synonym must be 120 characters or less.")
    .refine(
      (v) => normalizeSynonymTerm(v).length > 0,
      "Synonym cannot be only spaces.",
    ),
  example: optionalText(2000),
});

export const synonymGroupInputSchema = z
  .object({
    term: z
      .string()
      .trim()
      .min(1, "Enter a main word or phrase.")
      .max(120, "Main word must be 120 characters or less.")
      .refine(
        (v) => normalizeSynonymTerm(v).length > 0,
        "Main word cannot be only spaces.",
      ),
    meaning: optionalText(500),
    notes: optionalText(4000),
    synonyms: z
      .array(synonymItemSchema)
      .min(1, "Add at least one synonym.")
      .max(50, "You can add up to 50 synonyms per group."),
  })
  .refine(
    (data) => {
      const normalizedTerm = normalizeSynonymTerm(data.term);
      const seen = new Set<string>();
      for (const item of data.synonyms) {
        const norm = normalizeSynonymTerm(item.word);
        if (norm === normalizedTerm) {
          // A synonym shouldn't just be the main term itself
          return false;
        }
        if (seen.has(norm)) {
          return false;
        }
        seen.add(norm);
      }
      return true;
    },
    {
      message:
        "Duplicate synonyms within the group or matching the main term are not allowed.",
      path: ["synonyms"],
    },
  );

export const editSynonymGroupSchema = z
  .object({
    term: z
      .string()
      .trim()
      .min(1, "Enter a main word or phrase.")
      .max(120)
      .refine(
        (v) => normalizeSynonymTerm(v).length > 0,
        "Main word cannot be only spaces.",
      ),
    meaning: optionalText(500),
    notes: optionalText(4000),
    status: z.enum(synonymStatuses),
    synonyms: z
      .array(synonymItemSchema)
      .min(1, "Add at least one synonym.")
      .max(50),
  })
  .refine(
    (data) => {
      const normalizedTerm = normalizeSynonymTerm(data.term);
      const seen = new Set<string>();
      for (const item of data.synonyms) {
        const norm = normalizeSynonymTerm(item.word);
        if (norm === normalizedTerm) return false;
        if (seen.has(norm)) return false;
        seen.add(norm);
      }
      return true;
    },
    {
      message:
        "Duplicate synonyms within the group or matching the main term are not allowed.",
      path: ["synonyms"],
    },
  );

export const synonymGroupIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

export const synonymStatusInputSchema = z.object({
  id: synonymGroupIdSchema,
  status: z.enum(synonymStatuses),
});

export const synonymDateSchema = z
  .string()
  .refine(isDateKey, "Choose a valid date between 1970 and 2100.");

export const synonymMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .refine((v) => isDateKey(`${v}-01`), "Choose a valid month.");

export const synonymQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["ALL", ...synonymStatuses]).default("ALL"),
  date: z.union([synonymDateSchema, z.literal("")]).default(""),
  sort: z.enum(["newest", "oldest", "az", "za"]).default("newest"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});

export type SynonymGroupInput = z.infer<typeof synonymGroupInputSchema>;
export type EditSynonymGroupInput = z.infer<typeof editSynonymGroupSchema>;
export type SynonymQuery = z.infer<typeof synonymQuerySchema>;

export interface ParsedSynonymImportRow {
  row: number;
  term: string;
  meaning: string;
  notes: string;
  synonyms: Array<{ word: string; example: string }>;
  kind: "ready" | "duplicate" | "invalid";
  issues: string;
  normalized?: string;
}

export function parseSynonymImport(text: string): ParsedSynonymImportRow[] {
  if (new TextEncoder().encode(text).length > MAX_SYNONYM_IMPORT_BYTES) {
    throw new Error("Use a JSON file smaller than 256 KB.");
  }

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
    if (Array.isArray(obj.synonyms) && obj.synonyms.length) {
      raw = obj.synonyms;
    } else if (Array.isArray(obj.groups) && obj.groups.length) {
      raw = obj.groups;
    } else if (Array.isArray(obj.data) && obj.data.length) {
      raw = obj.data;
    } else if (
      ("term" in obj || "word" in obj || "main" in obj) &&
      ("synonyms" in obj || "items" in obj)
    ) {
      raw = [obj];
    }
  }

  if (!Array.isArray(raw) || !raw.length) {
    throw new Error("Provide a non-empty JSON array of synonym groups.");
  }

  if (raw.length > MAX_SYNONYM_IMPORT_ROWS) {
    throw new Error(
      `Import up to ${MAX_SYNONYM_IMPORT_ROWS} groups at a time.`,
    );
  }

  const seenInFile = new Set<string>();

  return raw.map((value: unknown, index): ParsedSynonymImportRow => {
    let item = value;
    if (typeof value === "object" && value !== null) {
      const rec = { ...(value as Record<string, unknown>) };
      if (!rec.term && (rec.word || rec.main || rec.en)) {
        rec.term = String(rec.word ?? rec.main ?? rec.en);
      }
      if (!rec.meaning && (rec.translation || rec.uz || rec.tarjima)) {
        rec.meaning = String(rec.translation ?? rec.uz ?? rec.tarjima);
      }
      if (Array.isArray(rec.synonyms) || Array.isArray(rec.items)) {
        const rawSyns = (rec.synonyms ?? rec.items) as unknown[];
        rec.synonyms = rawSyns.map((s) => {
          if (typeof s === "string") return { word: s, example: "" };
          if (typeof s === "object" && s !== null) {
            const sobj = s as Record<string, unknown>;
            return {
              word: String(sobj.word ?? sobj.term ?? ""),
              example: String(sobj.example ?? ""),
            };
          }
          return { word: String(s), example: "" };
        });
      }
      item = rec;
    }

    const parsed = synonymGroupInputSchema.safeParse(item);
    if (!parsed.success) {
      const termDisplay =
        typeof item === "object" &&
        item !== null &&
        "term" in item &&
        typeof (item as Record<string, unknown>).term === "string"
          ? ((item as Record<string, unknown>).term as string).slice(0, 120)
          : "—";

      return {
        row: index + 1,
        term: termDisplay,
        meaning: "",
        notes: "",
        synonyms: [],
        kind: "invalid",
        issues: parsed.error.issues
          .map((i) => `${i.path.join(".") || "row"}: ${i.message}`)
          .join("; "),
      };
    }

    const normalized = normalizeSynonymTerm(parsed.data.term);
    if (seenInFile.has(normalized)) {
      return {
        row: index + 1,
        term: parsed.data.term,
        meaning: parsed.data.meaning,
        notes: parsed.data.notes,
        synonyms: parsed.data.synonyms,
        kind: "duplicate",
        issues: "Repeated term inside this import file.",
        normalized,
      };
    }

    seenInFile.add(normalized);

    return {
      row: index + 1,
      term: parsed.data.term,
      meaning: parsed.data.meaning,
      notes: parsed.data.notes,
      synonyms: parsed.data.synonyms,
      kind: "ready",
      issues: "",
      normalized,
    };
  });
}
