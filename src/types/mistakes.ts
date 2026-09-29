import type { DailyModuleType } from "./daily-learning";

export type MistakeTabFilter = "ALL" | DailyModuleType;
export type MistakeSortFilter = "UNRESOLVED" | "RECENT" | "MOST_REPEATED";

export interface UnifiedMistakeItemDTO {
  id: string; // sourceId (wordId, groupId, or exerciseId)
  module: DailyModuleType;
  title: string; // word, term, or exercise prompt
  subTitle?: string; // topic title or definition
  latestWrongAnswer: string;
  correctAnswer: string;
  mistakesCount: number;
  totalAttempts: number;
  lastMistakeAt: string;
  isResolved: boolean;
  linkHref: string; // link to notebook or grammar topic
  topicId?: string;
  exerciseType?: string;
}

export interface UnifiedMistakesSummaryDTO {
  totalMistakesCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  moduleCounts: {
    VOCABULARY: number;
    SYNONYMS: number;
    GRAMMAR: number;
  };
  items: UnifiedMistakeItemDTO[];
}
