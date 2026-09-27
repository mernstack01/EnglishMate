export const wordStatuses = [
  "NEW",
  "LEARNING",
  "DIFFICULT",
  "LEARNED",
] as const;
export type WordStatus = (typeof wordStatuses)[number];
export const wordSources = ["MANUAL", "JSON", "IMAGE", "AI"] as const;
export type WordSource = (typeof wordSources)[number];
export const statusLabels = {
  NEW: "New",
  LEARNING: "Learning",
  DIFFICULT: "Difficult",
  LEARNED: "Learned",
} as const;
export const MAX_IMPORT_ROWS = 300;
export const MAX_IMPORT_BYTES = 256_000;
export function normalizeWord(word: string) {
  return word.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}
