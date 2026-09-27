import type {
  GrammarCategory,
  GrammarExerciseType,
  GrammarStatus,
} from "@/features/grammar/constants";

export type { GrammarCategory, GrammarExerciseType, GrammarStatus };

export interface GrammarTopicDTO {
  id: string;
  title: string;
  category: GrammarCategory;
  description: string;
  content: string;
  notes: string;
  status: GrammarStatus;
  exerciseCount: number;
  accuracy: number;
  attemptsCount: number;
  lastPracticedAt?: string;
  createdAt: string;
  updatedAt: string;
  date: string;
}

export interface GrammarExerciseDTO {
  id: string;
  grammarTopicId: string;
  type: GrammarExerciseType;
  question: string;
  options: string[];
  correctAnswer: string;
  acceptedAnswers: string[];
  explanation: string;
  difficulty: number;
  order: number;
  isActive: boolean;
  attemptCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  lastAttemptAt?: string;
  lastIsCorrect?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface GrammarAttemptDTO {
  id: string;
  grammarTopicId: string;
  grammarExerciseId: string;
  studySessionId?: string;
  exerciseType: GrammarExerciseType;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  createdAt: string;
}

export interface GrammarQuestionDTO {
  index: number;
  exerciseId: string;
  topicId: string;
  topicTitle: string;
  exerciseType: GrammarExerciseType;
  prompt: string;
  options: string[];
  correctAnswer: string;
  acceptedAnswers: string[];
  explanation: string;
  isAnswered: boolean;
  userAnswer?: string;
  isCorrect?: boolean | null;
}

export interface GrammarSessionDTO {
  id: string;
  topicId?: string;
  topicTitle?: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  currentQuestionIndex: number;
  isCompleted: boolean;
  questions: GrammarQuestionDTO[];
}

export interface GrammarSessionSummaryDTO {
  sessionId: string;
  topicId?: string;
  topicTitle?: string;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracy: number;
  streak: number;
  exercisesImproved: Array<{
    exerciseId: string;
    question: string;
    isCorrect: boolean;
  }>;
}

export interface GrammarMistakeItemDTO {
  attemptId: string;
  exerciseId: string;
  topicId: string;
  topicTitle: string;
  exerciseType: GrammarExerciseType;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  createdAt: string;
}

export interface GrammarMistakeGroupDTO {
  topicId: string;
  topicTitle: string;
  category: GrammarCategory;
  mistakesCount: number;
  recentMistakes: GrammarMistakeItemDTO[];
}

export interface GrammarImportExerciseInput {
  type: GrammarExerciseType;
  question: string;
  options?: string[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  explanation?: string;
  difficulty?: number;
}

export interface GrammarImportTopicInput {
  title: string;
  category?: GrammarCategory;
  description?: string;
  content?: string;
  notes?: string;
  exercises?: GrammarImportExerciseInput[];
}

export interface GrammarImportPreviewExercise {
  type: GrammarExerciseType;
  question: string;
  options: string[];
  correctAnswer: string;
  acceptedAnswers: string[];
  explanation: string;
  difficulty: number;
  status: "READY" | "INVALID";
  reason?: string;
}

export interface GrammarImportPreview {
  mode: "NEW_TOPIC" | "EXISTING_TOPIC";
  targetTopicId?: string;
  targetTopicTitle?: string;
  title: string;
  category: GrammarCategory;
  description: string;
  content: string;
  notes: string;
  totalDetected: number;
  readyCount: number;
  invalidCount: number;
  exercises: GrammarImportPreviewExercise[];
}

export interface GrammarStatsDTO {
  totalTopics: number;
  totalExercises: number;
  exercisesPracticed: number;
  accuracy: number;
  needsPracticeCount: number;
  newCount: number;
  learningCount: number;
  difficultCount: number;
  learnedCount: number;
}
