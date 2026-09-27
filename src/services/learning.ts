import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { ownedScope } from "@/lib/db/ownership";
import {
  VocabularyWord,
  type VocabularyRecord,
} from "@/models/vocabulary-word";
import {
  VocabularyReview,
  type ReviewRating,
} from "@/models/vocabulary-review";
import {
  StudySession,
  type SessionType,
  type StudySessionItem,
} from "@/models/study-session";
import {
  VocabularyAttempt,
  type ExerciseType,
} from "@/models/vocabulary-attempt";
import {
  calculateNextReview,
  calculateNextWordStatus,
} from "@/lib/spaced-repetition";
import { ensureUserReviews, vocabularyStats } from "./vocabulary";
import { calculateUserStreak } from "./streak";
import { normalizeWord } from "@/features/vocabulary/constants";
import type {
  LearningQuestionDTO,
  LearningSessionDTO,
  SessionSummaryDTO,
  WordSummaryDTO,
} from "@/types/learning";

export class LearningError extends Error {}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function cleanBlankExample(
  example: string | undefined,
  word: string,
): { sentence: string; hasMatch: boolean } {
  if (!example || !example.trim()) {
    return { sentence: "", hasMatch: false };
  }
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match the word with word boundaries where possible
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  if (regex.test(example)) {
    return {
      sentence: example.replace(regex, "______"),
      hasMatch: true,
    };
  }
  // Try case-insensitive substring if punctuation or affix prevents exact boundary
  const subRegex = new RegExp(escaped, "i");
  if (subRegex.test(example)) {
    return {
      sentence: example.replace(subRegex, "______"),
      hasMatch: true,
    };
  }
  return { sentence: "", hasMatch: false };
}

function buildQuestionDTO(
  item: StudySessionItem,
  idx: number,
  word:
    | {
        word: string;
        translation: string;
        example?: string | null;
      }
    | undefined,
  allUserWords: Array<{
    _id: Types.ObjectId | string;
    word: string;
    translation: string;
  }>,
  allTranslations: string[],
  allEnglishWords: string[],
): LearningQuestionDTO {
  const targetWord = word ? word.word : "Word";
  const targetTranslation = word ? word.translation : "Translation";

  let prompt = targetWord;
  let subPrompt = "Choose the correct translation";
  let options: string[] | undefined = undefined;
  let matchPairs: LearningQuestionDTO["matchPairs"] = undefined;

  if (
    item.exerciseType === "MULTIPLE_CHOICE" ||
    item.exerciseType === "EN_TO_UZ"
  ) {
    prompt = targetWord;
    subPrompt = "Choose the correct translation";
    const otherChoices = allTranslations.filter(
      (t) => t.toLowerCase() !== targetTranslation.toLowerCase(),
    );
    const distractors = shuffle(otherChoices).slice(0, 3);
    options = shuffle([targetTranslation, ...distractors]);
  } else if (item.exerciseType === "UZ_TO_EN") {
    prompt = targetTranslation;
    subPrompt = "Choose the correct English word";
    const otherChoices = allEnglishWords.filter(
      (w) => w.toLowerCase() !== targetWord.toLowerCase(),
    );
    const distractors = shuffle(otherChoices).slice(0, 3);
    options = shuffle([targetWord, ...distractors]);
  } else if (item.exerciseType === "TYPING") {
    prompt = targetTranslation;
    subPrompt = "Type the English word";
  } else if (item.exerciseType === "FILL_BLANK") {
    const blank = cleanBlankExample(word?.example ?? undefined, targetWord);
    prompt = blank.hasMatch ? blank.sentence : `The word is: ______`;
    subPrompt = `Fill in the blank (${targetTranslation})`;
    const otherChoices = allEnglishWords.filter(
      (w) => w.toLowerCase() !== targetWord.toLowerCase(),
    );
    options = shuffle([targetWord, ...shuffle(otherChoices).slice(0, 3)]);
  } else if (item.exerciseType === "MATCH") {
    prompt = "Match the English words with their Uzbek meanings";
    subPrompt = "Tap an English word, then tap its matching translation";
    const sample = shuffle(allUserWords).slice(0, 4);
    matchPairs = sample.map((w) => ({
      id: w._id.toString(),
      en: w.word,
      uz: w.translation,
    }));
  }

  return {
    index: idx,
    wordId: item.vocabularyWordId?.toString() ?? "",
    exerciseType: item.exerciseType as ExerciseType,
    prompt,
    subPrompt,
    options,
    matchPairs,
    targetWord,
    targetTranslation,
    isAnswered: item.answered,
    userAnswer: undefined,
    isCorrect: item.isCorrect,
  };
}

export async function getLearningOverview() {
  const owner = await ownedScope();
  await connectDB();
  await ensureUserReviews(owner.userId);

  const [stats, streak, sessionsCount] = await Promise.all([
    vocabularyStats(),
    calculateUserStreak(owner.userId),
    StudySession.countDocuments({
      userId: owner.userId,
      completedAt: { $ne: null },
    }),
  ]);

  return {
    dueCount: stats.due,
    newCount: stats.newToday,
    difficultCount: stats.difficult,
    totalCount: stats.total,
    learnedCount: stats.learned,
    streak,
    sessionsCount,
  };
}

export async function startStudySession(
  type: SessionType = "DAILY",
): Promise<string> {
  const owner = await ownedScope();
  await connectDB();
  await ensureUserReviews(owner.userId);

  const allWords = await VocabularyWord.find({ userId: owner.userId }).lean();
  if (!allWords.length) {
    throw new LearningError(
      "Your vocabulary notebook is empty. Add words first before practicing.",
    );
  }

  const allReviews = await VocabularyReview.find({
    userId: owner.userId,
  }).lean();
  const reviewMap = new Map<string, (typeof allReviews)[0]>();
  for (const r of allReviews) {
    reviewMap.set(r.vocabularyWordId.toString(), r);
  }

  const now = new Date();
  const dueWordIds = new Set<string>();
  for (const r of allReviews) {
    if (r.nextReviewAt <= now) {
      dueWordIds.add(r.vocabularyWordId.toString());
    }
  }

  let candidateWords: typeof allWords = [];

  if (type === "DUE") {
    candidateWords = allWords.filter((w) => dueWordIds.has(w._id.toString()));
    if (!candidateWords.length) {
      // If nothing is overdue, fallback to all words so user can practice anytime
      candidateWords = allWords;
    }
  } else if (type === "NEW") {
    candidateWords = allWords.filter((w) => w.status === "NEW");
    if (!candidateWords.length) candidateWords = allWords;
  } else if (type === "DIFFICULT") {
    candidateWords = allWords.filter((w) => w.status === "DIFFICULT");
    if (!candidateWords.length) {
      // Check words with high failures in review
      candidateWords = allWords.filter((w) => {
        const r = reviewMap.get(w._id.toString());
        return r && r.incorrectCount > 0;
      });
    }
    if (!candidateWords.length) candidateWords = allWords;
  } else {
    // "DAILY" or "CUSTOM": Balanced session (~60% due/difficult, ~40% new/recent)
    const dueOrDiff = allWords.filter(
      (w) => dueWordIds.has(w._id.toString()) || w.status === "DIFFICULT",
    );
    const newWords = allWords.filter((w) => w.status === "NEW");
    const otherWords = allWords.filter(
      (w) => !dueWordIds.has(w._id.toString()) && w.status !== "NEW",
    );

    const targetDue = Math.min(dueOrDiff.length, 9);
    const targetNew = Math.min(newWords.length, 6);

    const selectedDue = shuffle(dueOrDiff).slice(0, targetDue);
    const selectedNew = shuffle(newWords).slice(0, targetNew);
    const combined = [...selectedDue, ...selectedNew];

    if (combined.length < 10) {
      const remainingNeeded = 10 - combined.length;
      const combinedIds = new Set(combined.map((w) => w._id.toString()));
      const availableOthers = otherWords.filter(
        (w) => !combinedIds.has(w._id.toString()),
      );
      combined.push(...shuffle(availableOthers).slice(0, remainingNeeded));
    }
    candidateWords = combined.length > 0 ? combined : allWords;
  }

  // Gracefully handle small vocabulary (e.g. 3-5 words)
  const sessionWordCount = Math.min(15, Math.max(candidateWords.length, 1));
  const selectedWords = shuffle(candidateWords).slice(0, sessionWordCount);

  // Generate question items with varied exercise types
  const items: StudySessionItem[] = [];
  selectedWords.forEach((word, index) => {
    let exerciseType: ExerciseType = "MULTIPLE_CHOICE";
    const blank = cleanBlankExample(word.example, word.word);

    if (blank.hasMatch && Math.random() < 0.35) {
      exerciseType = "FILL_BLANK";
    } else if (word.status === "NEW") {
      exerciseType = index % 2 === 0 ? "MULTIPLE_CHOICE" : "EN_TO_UZ";
    } else if (word.status === "LEARNED") {
      exerciseType = index % 2 === 0 ? "TYPING" : "UZ_TO_EN";
    } else {
      const types: ExerciseType[] = [
        "MULTIPLE_CHOICE",
        "EN_TO_UZ",
        "UZ_TO_EN",
        "TYPING",
      ];
      exerciseType = types[index % types.length];
    }

    items.push({
      vocabularyWordId: word._id,
      exerciseType,
      order: index,
      answered: false,
      isCorrect: null,
      retryCount: 0,
    });
  });

  // If user has at least 4 words, add a MATCH game question at the end for variety
  if (selectedWords.length >= 4) {
    items.push({
      vocabularyWordId: selectedWords[0]._id,
      exerciseType: "MATCH",
      order: items.length,
      answered: false,
      isCorrect: null,
      retryCount: 0,
    });
  }

  const session = await StudySession.create({
    userId: owner.userId,
    type,
    startedAt: new Date(),
    totalQuestions: items.length,
    answeredQuestions: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    items,
  });

  return session._id.toString();
}

export async function getStudySession(
  sessionId: string,
): Promise<LearningSessionDTO> {
  const owner = await ownedScope();
  await connectDB();

  if (!Types.ObjectId.isValid(sessionId)) {
    throw new LearningError("Invalid session ID");
  }

  const session = await StudySession.findOne({
    _id: sessionId,
    userId: owner.userId,
  }).lean();

  if (!session) {
    throw new LearningError("Session not found");
  }

  // Fetch words needed for questions and distractors
  const allUserWords = await VocabularyWord.find({
    userId: owner.userId,
  }).lean();
  const wordMap = new Map<string, VocabularyRecord & { _id: Types.ObjectId }>();
  for (const w of allUserWords) {
    wordMap.set(w._id.toString(), w);
  }

  const allTranslations = Array.from(
    new Set(allUserWords.map((w) => w.translation.trim())),
  );
  const allEnglishWords = Array.from(
    new Set(allUserWords.map((w) => w.word.trim())),
  );

  const questions: LearningQuestionDTO[] = session.items.map((item, idx) =>
    buildQuestionDTO(
      item,
      idx,
      wordMap.get(item.vocabularyWordId?.toString() ?? ""),
      allUserWords,
      allTranslations,
      allEnglishWords,
    ),
  );

  return {
    id: session._id.toString(),
    type: session.type,
    totalQuestions: session.totalQuestions,
    answeredQuestions: session.answeredQuestions,
    correctAnswers: session.correctAnswers,
    incorrectAnswers: session.incorrectAnswers,
    completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    questions,
  };
}

export async function submitSessionAnswer(
  sessionId: string,
  questionIndex: number,
  userAnswer: string,
  ratingOverride?: ReviewRating,
) {
  const owner = await ownedScope();
  await connectDB();

  if (!Types.ObjectId.isValid(sessionId)) {
    throw new LearningError("Invalid session ID");
  }

  const session = await StudySession.findOne({
    _id: sessionId,
    userId: owner.userId,
  });

  if (!session) {
    throw new LearningError("Session not found");
  }

  const item = session.items[questionIndex];
  if (!item) {
    throw new LearningError("Question not found in session");
  }

  const word = await VocabularyWord.findOne({
    _id: item.vocabularyWordId,
    userId: owner.userId,
  });

  if (!word) {
    throw new LearningError("Target word not found");
  }

  // Idempotency: If already answered, return previous result
  if (item.answered) {
    return {
      alreadyAnswered: true,
      isCorrect: item.isCorrect ?? false,
      correctAnswer:
        item.exerciseType === "UZ_TO_EN" ||
        item.exerciseType === "TYPING" ||
        item.exerciseType === "FILL_BLANK"
          ? word.word
          : word.translation,
      isCompleted: !!session.completedAt,
    };
  }

  // Evaluate correctness
  let isCorrect = false;
  const targetWord = word.word.trim();
  const targetTranslation = word.translation.trim();
  const normalizedAns = normalizeWord(userAnswer);

  if (item.exerciseType === "MATCH") {
    // For match game, frontend submits when all pairs matched correctly
    isCorrect = userAnswer === "MATCHED" || userAnswer === "CORRECT";
  } else if (
    item.exerciseType === "UZ_TO_EN" ||
    item.exerciseType === "TYPING" ||
    item.exerciseType === "FILL_BLANK"
  ) {
    isCorrect = normalizedAns === normalizeWord(targetWord);
  } else {
    // MULTIPLE_CHOICE or EN_TO_UZ
    isCorrect =
      normalizeWord(userAnswer) === normalizeWord(targetTranslation) ||
      userAnswer.trim().toLowerCase() === targetTranslation.toLowerCase();
  }

  // Determine review rating
  let rating: ReviewRating;
  if (ratingOverride) {
    rating = ratingOverride;
  } else if (!isCorrect) {
    rating = "AGAIN";
  } else {
    rating = "GOOD";
  }

  // Record attempt
  await VocabularyAttempt.create({
    userId: owner.userId,
    vocabularyWordId: word._id,
    studySessionId: session._id,
    exerciseType: item.exerciseType as ExerciseType,
    prompt:
      item.exerciseType === "UZ_TO_EN" || item.exerciseType === "TYPING"
        ? targetTranslation
        : targetWord,
    userAnswer,
    correctAnswer:
      item.exerciseType === "UZ_TO_EN" ||
      item.exerciseType === "TYPING" ||
      item.exerciseType === "FILL_BLANK"
        ? targetWord
        : targetTranslation,
    isCorrect,
    rating,
  });

  // Update canonical VocabularyReview
  let review = await VocabularyReview.findOne({
    userId: owner.userId,
    vocabularyWordId: word._id,
  });

  if (!review) {
    review = new VocabularyReview({
      userId: owner.userId,
      vocabularyWordId: word._id,
      nextReviewAt: word.review?.nextReviewAt || new Date(),
      lastReviewedAt: null,
      intervalDays: word.review?.intervalDays || 0,
      easeFactor: word.review?.easeFactor || 2.5,
      repetitions: word.review?.repetitions || 0,
      correctCount: word.review?.correctCount || 0,
      incorrectCount: word.review?.incorrectCount || 0,
    });
  }

  const reviewResult = calculateNextReview(review, rating);
  review.nextReviewAt = reviewResult.nextReviewAt;
  review.lastReviewedAt = reviewResult.lastReviewedAt;
  review.intervalDays = reviewResult.intervalDays;
  review.easeFactor = reviewResult.easeFactor;
  review.repetitions = reviewResult.repetitions;
  review.correctCount = reviewResult.correctCount;
  review.incorrectCount = reviewResult.incorrectCount;
  review.lastRating = reviewResult.lastRating;
  await review.save();

  // Update word status and keep embedded review in sync
  const nextStatus = calculateNextWordStatus(
    word.status,
    rating,
    reviewResult,
    item.retryCount,
  );
  word.status = nextStatus;
  word.review = {
    nextReviewAt: reviewResult.nextReviewAt,
    lastReviewedAt: reviewResult.lastReviewedAt,
    intervalDays: reviewResult.intervalDays,
    easeFactor: reviewResult.easeFactor,
    repetitions: reviewResult.repetitions,
    correctCount: reviewResult.correctCount,
    incorrectCount: reviewResult.incorrectCount,
  };
  await word.save();

  // Update session item
  item.answered = true;
  item.isCorrect = isCorrect;
  session.answeredQuestions += 1;
  if (isCorrect) {
    session.correctAnswers += 1;
  } else {
    session.incorrectAnswers += 1;
  }

  // Wrong answer reinsertion: if incorrect and retry count < 2, reinsert later
  let reinsertedQuestion: LearningQuestionDTO | undefined = undefined;
  let reinsertIndex: number | undefined = undefined;

  if (!isCorrect && item.retryCount < 2 && item.exerciseType !== "MATCH") {
    reinsertIndex = Math.min(session.items.length, questionIndex + 4);
    // Switch exercise type for variety (e.g. from typing to multiple choice)
    const retryExercise: ExerciseType =
      item.exerciseType === "TYPING" ? "MULTIPLE_CHOICE" : "EN_TO_UZ";
    const newItem: StudySessionItem = {
      vocabularyWordId: word._id,
      exerciseType: retryExercise,
      order: session.items.length,
      answered: false,
      isCorrect: null,
      retryCount: item.retryCount + 1,
    };
    session.items.splice(reinsertIndex, 0, newItem);
    session.totalQuestions = session.items.length;
    session.items.forEach((it, i) => {
      it.order = i;
    });

    const allUserWords = await VocabularyWord.find({
      userId: owner.userId,
    }).lean();
    const allTranslations = Array.from(
      new Set(allUserWords.map((w) => w.translation.trim())),
    );
    const allEnglishWords = Array.from(
      new Set(allUserWords.map((w) => w.word.trim())),
    );

    reinsertedQuestion = buildQuestionDTO(
      newItem,
      reinsertIndex,
      word,
      allUserWords as unknown as Array<{
        _id: Types.ObjectId | string;
        word: string;
        translation: string;
      }>,
      allTranslations,
      allEnglishWords,
    );
  }

  // Check if session is completed
  const allAnswered = session.items.every((it) => it.answered);
  if (allAnswered) {
    session.completedAt = new Date();
  }

  await session.save();

  return {
    alreadyAnswered: false,
    isCorrect,
    correctAnswer:
      item.exerciseType === "UZ_TO_EN" ||
      item.exerciseType === "TYPING" ||
      item.exerciseType === "FILL_BLANK"
        ? targetWord
        : targetTranslation,
    rating,
    isCompleted: allAnswered,
    answeredQuestions: session.answeredQuestions,
    totalQuestions: session.totalQuestions,
    reinsertedQuestion,
    reinsertIndex,
  };
}

export async function getSessionSummary(
  sessionId: string,
): Promise<SessionSummaryDTO> {
  const owner = await ownedScope();
  await connectDB();

  if (!Types.ObjectId.isValid(sessionId)) {
    throw new LearningError("Invalid session ID");
  }

  const session = await StudySession.findOne({
    _id: sessionId,
    userId: owner.userId,
  }).lean();

  if (!session) {
    throw new LearningError("Session not found");
  }

  // Get attempts for this session to identify improved vs words to review
  const attempts = await VocabularyAttempt.find({
    studySessionId: session._id,
    userId: owner.userId,
  }).lean();

  const wordIds = Array.from(
    new Set(attempts.map((a) => a.vocabularyWordId.toString())),
  );
  const words = await VocabularyWord.find({
    _id: { $in: wordIds },
    userId: owner.userId,
  }).lean();
  const wordMap = new Map<string, (typeof words)[0]>();
  for (const w of words) wordMap.set(w._id.toString(), w);

  const wordsImproved: WordSummaryDTO[] = [];
  const wordsToReview: WordSummaryDTO[] = [];

  const wordFailures = new Map<string, number>();
  const wordSuccesses = new Map<string, number>();

  for (const att of attempts) {
    const wid = att.vocabularyWordId.toString();
    if (!att.isCorrect) {
      wordFailures.set(wid, (wordFailures.get(wid) || 0) + 1);
    } else {
      wordSuccesses.set(wid, (wordSuccesses.get(wid) || 0) + 1);
    }
  }

  for (const wid of wordIds) {
    const w = wordMap.get(wid);
    if (!w) continue;
    const failures = wordFailures.get(wid) || 0;
    const successes = wordSuccesses.get(wid) || 0;
    const entry: WordSummaryDTO = {
      id: w._id.toString(),
      word: w.word,
      translation: w.translation,
    };
    if (failures > 0) {
      wordsToReview.push(entry);
    } else if (successes > 0) {
      wordsImproved.push(entry);
    }
  }

  const answered = session.answeredQuestions || 1;
  const accuracy = Math.round((session.correctAnswers / answered) * 100);

  return {
    id: session._id.toString(),
    type: session.type,
    totalQuestions: session.totalQuestions,
    answeredQuestions: session.answeredQuestions,
    correctAnswers: session.correctAnswers,
    incorrectAnswers: session.incorrectAnswers,
    accuracy,
    completedAt: (session.completedAt || new Date()).toISOString(),
    wordsImproved,
    wordsToReview,
  };
}
