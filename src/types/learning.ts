import type { ExerciseType } from "@/models/vocabulary-attempt";
import type { SessionType } from "@/models/study-session";

export interface MatchPairDTO {
  id: string;
  en: string;
  uz: string;
}

export interface LearningQuestionDTO {
  index: number;
  wordId: string;
  exerciseType: ExerciseType;
  prompt: string;
  subPrompt: string;
  options?: string[];
  matchPairs?: MatchPairDTO[];
  targetWord: string;
  targetTranslation: string;
  isAnswered: boolean;
  userAnswer?: string;
  isCorrect?: boolean | null;
}

export interface LearningSessionDTO {
  id: string;
  type: SessionType;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  completedAt: string | null;
  questions: LearningQuestionDTO[];
}

export interface WordSummaryDTO {
  id: string;
  word: string;
  translation: string;
}

export interface SessionSummaryDTO {
  id: string;
  type: SessionType;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracy: number;
  completedAt: string;
  wordsImproved: WordSummaryDTO[];
  wordsToReview: WordSummaryDTO[];
}

export interface AnswerSubmissionResultDTO {
  alreadyAnswered: boolean;
  isCorrect: boolean;
  correctAnswer: string;
  rating?: string;
  isCompleted: boolean;
  answeredQuestions?: number;
  totalQuestions?: number;
  reinsertedQuestion?: LearningQuestionDTO;
  reinsertIndex?: number;
}
