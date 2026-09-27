export const synonymStatuses = [
  "NEW",
  "LEARNING",
  "DIFFICULT",
  "LEARNED",
] as const;

export type SynonymStatus = (typeof synonymStatuses)[number];

export const synonymSources = ["MANUAL", "JSON"] as const;
export type SynonymSource = (typeof synonymSources)[number];

export const synonymStatusLabels: Record<SynonymStatus, string> = {
  NEW: "New",
  LEARNING: "Learning",
  DIFFICULT: "Difficult",
  LEARNED: "Learned",
};

export const MAX_SYNONYM_IMPORT_ROWS = 300;
export const MAX_SYNONYM_IMPORT_BYTES = 256_000;

export function normalizeSynonymTerm(term: string): string {
  return term.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}
