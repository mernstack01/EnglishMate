import type { ModuleSessionBreakdown } from "@/models/study-session";

export type DailyModuleType = "VOCABULARY" | "SYNONYMS" | "GRAMMAR";

export interface DailyPlanItemCandidate {
  module: DailyModuleType;
  sourceId: string;
  exerciseType: string;
  priorityScore: number;
  reason: "DUE" | "MISTAKE" | "DIFFICULT" | "NEW" | "REINFORCE";
}

export interface DailyLearningPlanDTO {
  vocabularyCount: number;
  synonymsCount: number;
  grammarCount: number;
  totalCount: number;
  estimatedMinutes: number;
  availableModules: DailyModuleType[];
  dueCount: number;
  mistakesCount: number;
  newCount: number;
  activeSessionId?: string | null;
  activeSessionProgress?: {
    answered: number;
    total: number;
  } | null;
}

export interface DailyQuestionDTO {
  sessionItemId: string;
  order: number;
  module: DailyModuleType;
  exerciseType: string;
  type?: string;
  sourceId: string;
  exerciseId?: string;
  grammarTopicId?: string;
  prompt: string;
  question?: string;
  subPrompt?: string;
  options?: string[];
  correctAnswers?: string[];
  explanation?: string;
  notes?: string;
  matchPairs?: Array<{
    id: string;
    left: string;
    right: string;
  }>;
  isAnswered: boolean;
  isCorrect: boolean | null;
  topicTitle?: string;
}

export interface DailySessionStateDTO {
  id: string;
  module: "MIXED";
  type: "DAILY" | "MISTAKES";
  studyDate?: string;
  totalQuestions: number;
  plannedQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  activeStudySeconds: number;
  isCompleted: boolean;
  completedAt: string | null;
  currentIndex: number;
  questions: DailyQuestionDTO[];
  moduleBreakdown: {
    vocabulary: ModuleSessionBreakdown;
    synonyms: ModuleSessionBreakdown;
    grammar: ModuleSessionBreakdown;
  };
}

export interface DailyAnswerSubmissionResult {
  alreadyAnswered: boolean;
  isCorrect: boolean;
  correctAnswer: string;
  explanation?: string;
  isCompleted: boolean;
  answeredQuestions: number;
  totalQuestions: number;
  activeStudySeconds: number;
  reinsertedQuestion?: DailyQuestionDTO;
  reinsertIndex?: number;
  moduleBreakdown: {
    vocabulary: ModuleSessionBreakdown;
    synonyms: ModuleSessionBreakdown;
    grammar: ModuleSessionBreakdown;
  };
}

export interface DailySessionSummaryDTO {
  sessionId: string;
  type: string;
  studyDate?: string;
  plannedQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  overallAccuracy: number;
  activeStudySeconds: number;
  activeStudyMinutes: number;
  currentStreak: number;
  moduleBreakdown: {
    vocabulary: ModuleSessionBreakdown & { accuracy: number };
    synonyms: ModuleSessionBreakdown & { accuracy: number };
    grammar: ModuleSessionBreakdown & { accuracy: number };
  };
  mistakesCount: number;
}
