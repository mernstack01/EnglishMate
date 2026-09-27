export const grammarCategories = [
  "TENSES",
  "MODAL_VERBS",
  "RELATIVE_CLAUSES",
  "CONDITIONALS",
  "PREPOSITIONS",
  "ARTICLES",
  "PASSIVE_VOICE",
  "REPORTED_SPEECH",
  "GERUNDS_INFINITIVES",
  "OTHER",
] as const;

export type GrammarCategory = (typeof grammarCategories)[number];

export const grammarCategoryLabels: Record<GrammarCategory, string> = {
  TENSES: "Tenses & Verb Forms",
  MODAL_VERBS: "Modal Verbs",
  RELATIVE_CLAUSES: "Relative Clauses",
  CONDITIONALS: "Conditionals",
  PREPOSITIONS: "Prepositions",
  ARTICLES: "Articles & Determiners",
  PASSIVE_VOICE: "Passive Voice",
  REPORTED_SPEECH: "Reported Speech",
  GERUNDS_INFINITIVES: "Gerunds & Infinitives",
  OTHER: "Other Topics",
};

export const grammarStatuses = [
  "NEW",
  "LEARNING",
  "DIFFICULT",
  "LEARNED",
] as const;

export type GrammarStatus = (typeof grammarStatuses)[number];

export const grammarStatusLabels: Record<GrammarStatus, string> = {
  NEW: "New",
  LEARNING: "Learning",
  DIFFICULT: "Difficult",
  LEARNED: "Learned",
};

export const grammarExerciseTypes = [
  "MULTIPLE_CHOICE",
  "FILL_BLANK",
  "TEXT_INPUT",
  "TRUE_FALSE",
  "SENTENCE_CORRECTION",
] as const;

export type GrammarExerciseType = (typeof grammarExerciseTypes)[number];

export const grammarExerciseTypeLabels: Record<GrammarExerciseType, string> = {
  MULTIPLE_CHOICE: "Multiple Choice",
  FILL_BLANK: "Fill in the Blank",
  TEXT_INPUT: "Write Answer / Transformation",
  TRUE_FALSE: "True / False",
  SENTENCE_CORRECTION: "Sentence Correction",
};

export const MAX_GRAMMAR_IMPORT_ROWS = 200;
export const MAX_GRAMMAR_IMPORT_BYTES = 512_000;

export function normalizeGrammarTitle(title: string): string {
  return title.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

/**
 * Normalizes grammar answers:
 * - Trims leading/trailing whitespace
 * - Collapses internal whitespace to single spaces
 * - Lowercases for case-insensitivity
 * - Strips trailing terminal punctuation (. , ! ?) without destroying internal punctuation like apostrophes ("couldn't")
 */
export function normalizeGrammarAnswer(answer: unknown): string {
  if (typeof answer !== "string") {
    if (typeof answer === "boolean") return answer ? "true" : "false";
    if (typeof answer === "number") return String(answer);
    return "";
  }
  return answer
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .replace(/[.?!,]+$/u, "")
    .trim();
}

export function normalizeBooleanString(val: unknown): "true" | "false" | null {
  if (typeof val === "boolean") return val ? "true" : "false";
  const norm = normalizeGrammarAnswer(val);
  if (["true", "t", "yes", "y", "1"].includes(norm)) return "true";
  if (["false", "f", "no", "n", "0"].includes(norm)) return "false";
  return null;
}

/**
 * Checks whether a given user answer matches the correct answer or accepted answers.
 * Supports both signatures:
 *   (userAnswer, correctAnswer, acceptedAnswers, exerciseType)
 *   (exerciseType, userAnswer, correctAnswer, acceptedAnswers)
 */
export function isGrammarAnswerAccepted(
  arg1: unknown,
  arg2: unknown,
  arg3?: unknown,
  arg4?: unknown,
): boolean {
  let exerciseType: GrammarExerciseType | undefined;
  let userAnswer: string;
  let correctAnswer: string;
  let acceptedAnswers: string[] = [];

  const types = [
    "MULTIPLE_CHOICE",
    "FILL_BLANK",
    "TEXT_INPUT",
    "TRUE_FALSE",
    "SENTENCE_CORRECTION",
  ];

  if (typeof arg1 === "string" && types.includes(arg1)) {
    // Signature: (exerciseType, userAnswer, correctAnswer, acceptedAnswers)
    exerciseType = arg1 as GrammarExerciseType;
    userAnswer = String(arg2 ?? "");
    correctAnswer = String(arg3 ?? "");
    acceptedAnswers = Array.isArray(arg4) ? arg4.map(String) : [];
  } else {
    // Signature: (userAnswer, correctAnswer, acceptedAnswers, exerciseType)
    userAnswer = String(arg1 ?? "");
    correctAnswer = String(arg2 ?? "");
    acceptedAnswers = Array.isArray(arg3) ? arg3.map(String) : [];
    exerciseType =
      typeof arg4 === "string" ? (arg4 as GrammarExerciseType) : undefined;
  }

  if (exerciseType === "TRUE_FALSE") {
    const userBool = normalizeBooleanString(userAnswer);
    const correctBool = normalizeBooleanString(correctAnswer);
    return !!userBool && userBool === correctBool;
  }

  const normalizedUser = normalizeGrammarAnswer(userAnswer);
  if (!normalizedUser) return false;

  const validTargets = [correctAnswer, ...acceptedAnswers].map(
    normalizeGrammarAnswer,
  );

  return validTargets.includes(normalizedUser);
}
