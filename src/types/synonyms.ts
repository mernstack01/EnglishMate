import type {
  SynonymStatus,
  SynonymSource,
} from "@/features/synonyms/constants";

export interface SynonymItemDTO {
  word: string;
  example?: string;
}

export interface SynonymGroupDTO {
  id: string;
  term: string;
  meaning: string;
  notes: string;
  synonyms: SynonymItemDTO[];
  status: SynonymStatus;
  source: SynonymSource;
  createdAt: string;
  updatedAt: string;
  date: string;
  nextReviewAt?: string;
  intervalDays?: number;
}

export interface SynonymImportRow {
  term: string;
  meaning?: string;
  notes?: string;
  synonyms: string[] | SynonymItemDTO[];
}

export interface SynonymImportPreviewItem {
  term: string;
  meaning: string;
  notes: string;
  synonyms: SynonymItemDTO[];
  status: "READY" | "DUPLICATE" | "INVALID";
  reason?: string;
}

export interface SynonymImportPreview {
  total: number;
  ready: number;
  duplicates: number;
  invalid: number;
  items: SynonymImportPreviewItem[];
}

export interface SynonymImportResult {
  saved: number;
  skipped: number;
  total: number;
}

export type SynonymExerciseType =
  "RECOGNITION" | "REVERSE_RECOGNITION" | "MULTI_ANSWER" | "TYPING" | "MATCH";

export interface SynonymMatchPair {
  id: string;
  left: string; // e.g. term "want to"
  right: string; // e.g. synonym "would like to"
}

export interface SynonymQuestionDTO {
  id: string;
  groupId: string;
  exerciseType: SynonymExerciseType;
  prompt: string;
  subPrompt?: string;
  meaning?: string;
  notes?: string;
  options?: string[]; // for RECOGNITION, REVERSE_RECOGNITION, MULTI_ANSWER
  correctAnswers?: string[]; // for MULTI_ANSWER verification
  matchPairs?: SynonymMatchPair[]; // for MATCH game
  allSynonyms?: string[]; // for TYPING context on review
}

export interface SynonymSessionDTO {
  id: string;
  type: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  completedAt: string | null;
  questions: SynonymQuestionDTO[];
}

export interface SynonymGroupSummaryDTO {
  id: string;
  term: string;
  meaning: string;
  synonyms: string[];
}

export interface SynonymSessionSummaryDTO {
  id: string;
  type: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracy: number;
  completedAt: string;
  groupsImproved: SynonymGroupSummaryDTO[];
  groupsToReview: SynonymGroupSummaryDTO[];
}

export interface SynonymStatsDTO {
  total: number;
  newToday: number;
  due: number;
  learned: number;
  difficult: number;
}
