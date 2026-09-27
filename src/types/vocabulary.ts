import type { wordStatuses } from "@/features/vocabulary/constants";
export interface VocabularyDTO {
  id: string;
  word: string;
  translation: string;
  definition: string;
  example: string;
  pronunciation: string;
  partOfSpeech: string;
  notes: string;
  status: (typeof wordStatuses)[number];
  difficulty: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  date: string;
}
export interface ImportRow {
  row: number;
  word: string;
  translation?: string;
  kind: "ready" | "invalid" | "duplicate" | "existing";
  issues: string;
}
export interface ImportPreview {
  rows: ImportRow[];
  detected: number;
  ready: number;
  invalid: number;
  existing: number;
  duplicate: number;
}
export interface ImportResult {
  imported: number;
  skippedDuplicates: number;
  invalid: number;
  rows: ImportRow[];
}
