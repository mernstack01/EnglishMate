import type { GrammarCategory } from "@/features/grammar/constants";

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1";

export interface CefrEvaluation {
  level: CefrLevel;
  title: string;
  ieltsBand: string;
  description: string;
  criteriaProgress: {
    vocabularyCount: number;
    targetVocabulary: number;
    grammarAccuracy: number;
    targetAccuracy: number;
    synonymDepth: number;
    targetSynonyms: number;
  };
}

export interface MasteryOverviewDTO {
  overallScore: number; // 0-100
  cefr: CefrEvaluation;
  currentStreak: number;
  longestStreak: number;
  activeDaysCount: number;
  totalSessionsCompleted: number;
  totalQuestionsAnswered: number;
  overallAccuracy: number;
  moduleSessionCounts: {
    vocabulary: number;
    synonyms: number;
    grammar: number;
  };
}

export interface VocabularyAnalyticsDTO {
  totalWords: number;
  statusCounts: {
    new: number;
    learning: number;
    difficult: number;
    learned: number;
  };
  retentionRate: number; // 0-100%
  totalAttempts: number;
  correctAttempts: number;
  intervalStages: {
    learningCount: number; // interval < 4 days
    maturingCount: number; // interval 4-14 days
    matureCount: number; // interval 15+ days
  };
  dueCount: number;
  addedThisWeekCount: number;
}

export interface SynonymAnalyticsDTO {
  totalGroups: number;
  totalSynonyms: number;
  avgSynonymsPerGroup: number;
  statusCounts: {
    new: number;
    learning: number;
    difficult: number;
    learned: number;
  };
  recallAccuracy: number; // 0-100%
  totalAttempts: number;
  correctAttempts: number;
  dueCount: number;
}

export interface GrammarCategoryAnalytics {
  category: GrammarCategory;
  label: string;
  topicCount: number;
  attemptsCount: number;
  correctCount: number;
  accuracy: number;
}

export interface GrammarExerciseTypeAnalytics {
  exerciseType: string;
  label: string;
  attemptsCount: number;
  correctCount: number;
  accuracy: number;
}

export interface GrammarTopicChallengeDTO {
  id: string;
  title: string;
  category: GrammarCategory;
  status: string;
  attemptsCount: number;
  accuracy: number;
  mistakesCount: number;
}

export interface GrammarAnalyticsDTO {
  totalTopics: number;
  topicsLearned: number;
  topicsPracticed: number;
  coveragePercent: number;
  totalAttempts: number;
  correctAttempts: number;
  overallAccuracy: number;
  categoryBreakdown: GrammarCategoryAnalytics[];
  exerciseTypeBreakdown: GrammarExerciseTypeAnalytics[];
  challengingTopics: GrammarTopicChallengeDTO[];
}

export interface DailyActivityItemDTO {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6
  dayOfMonth: number;
  displayDay: string;
  completedSessions: number;
  questionsAnswered: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

export interface SmartRecommendationDTO {
  id: string;
  type: "ACTION" | "STRENGTH" | "FOCUS";
  title: string;
  description: string;
  metric?: string;
  actionHref?: string;
  actionLabel?: string;
}

export interface ProgressAnalyticsDTO {
  mastery: MasteryOverviewDTO;
  vocabulary: VocabularyAnalyticsDTO;
  synonyms: SynonymAnalyticsDTO;
  grammar: GrammarAnalyticsDTO;
  activity30Days: DailyActivityItemDTO[];
  recommendations: SmartRecommendationDTO[];
}
