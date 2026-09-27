import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { ownedScope } from "@/lib/db/ownership";
import { SynonymGroup, type SynonymGroupRecord } from "@/models/synonym-group";
import {
  SynonymReview,
  type SynonymReviewRecord,
} from "@/models/synonym-review";
import {
  StudySession,
  type SessionType,
  type StudySessionItem,
} from "@/models/study-session";
import {
  SynonymAttempt,
  type SynonymExerciseType,
} from "@/models/synonym-attempt";
import type { ReviewRating } from "@/models/vocabulary-review";
import {
  calculateNextReview,
  calculateNextWordStatus,
} from "@/lib/spaced-repetition";
import { ensureUserSynonymReviews, synonymStats } from "./synonyms";
import { calculateUserStreak } from "./streak";
import { normalizeSynonymTerm } from "@/features/synonyms/constants";
import type {
  SynonymQuestionDTO,
  SynonymSessionDTO,
  SynonymSessionSummaryDTO,
  SynonymGroupSummaryDTO,
  SynonymMatchPair,
} from "@/types/synonyms";

export class SynonymLearningError extends Error {}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function getSynonymLearningOverview() {
  const owner = await ownedScope();
  await connectDB();
  await ensureUserSynonymReviews(owner.userId);

  const stats = await synonymStats();
  const streak = await calculateUserStreak(owner.userId);

  return {
    dueCount: stats.due,
    newCount: stats.newToday,
    difficultCount: stats.difficult,
    learnedCount: stats.learned,
    totalCount: stats.total,
    streak,
  };
}

function buildSynonymQuestionDTO(
  item: StudySessionItem,
  idx: number,
  group: (SynonymGroupRecord & { _id: Types.ObjectId }) | undefined,
  allUserGroups: Array<SynonymGroupRecord & { _id: Types.ObjectId }>,
): SynonymQuestionDTO {
  const targetTerm = group ? group.term : "Term";
  const targetMeaning = group ? group.meaning : "";
  const targetNotes = group ? group.notes : "";
  const targetSynonyms = group ? group.synonyms.map((s) => s.word) : [];

  let prompt = targetTerm;
  let subPrompt = "Choose a synonym";
  let options: string[] | undefined = undefined;
  let correctAnswers: string[] | undefined = undefined;
  let matchPairs: SynonymMatchPair[] | undefined = undefined;
  const exType = item.exerciseType as SynonymExerciseType;

  // Collect other synonyms across user's other groups for distractors
  const otherSynonyms: string[] = [];
  const otherTerms: string[] = [];
  for (const g of allUserGroups) {
    if (!group || g._id.toString() !== group._id.toString()) {
      otherTerms.push(g.term);
      for (const s of g.synonyms) {
        otherSynonyms.push(s.word);
      }
    }
  }

  // Fallback distractors if user has very few synonym groups
  const defaultDistractors = [
    "remarkable",
    "frequently",
    "subsequent",
    "beneficial",
    "essential",
    "gradual",
    "adequate",
    "precise",
  ];

  if (exType === "RECOGNITION") {
    // Prompt: term -> select 1 synonym
    subPrompt = "Choose a synonym of:";
    prompt = targetTerm;
    const correctWord =
      targetSynonyms.length > 0
        ? targetSynonyms[Math.floor(Math.random() * targetSynonyms.length)]
        : "synonym";

    const distractors = shuffle(
      otherSynonyms.filter((s) => !targetSynonyms.includes(s)),
    ).slice(0, 3);

    while (distractors.length < 3) {
      const fallback =
        defaultDistractors[distractors.length % defaultDistractors.length];
      if (!distractors.includes(fallback) && fallback !== correctWord) {
        distractors.push(fallback);
      } else {
        distractors.push(`option_${distractors.length + 1}`);
      }
    }

    options = shuffle([correctWord, ...distractors]);
    correctAnswers = [correctWord];
  } else if (exType === "REVERSE_RECOGNITION") {
    // Prompt: synonym -> which main word is closest?
    const chosenSynonym =
      targetSynonyms.length > 0
        ? targetSynonyms[Math.floor(Math.random() * targetSynonyms.length)]
        : targetTerm;
    subPrompt = "Which main word is closest to:";
    prompt = chosenSynonym;

    const distractors = shuffle(
      otherTerms.filter((t) => t !== targetTerm),
    ).slice(0, 3);

    while (distractors.length < 3) {
      const fallback =
        defaultDistractors[distractors.length % defaultDistractors.length];
      if (!distractors.includes(fallback) && fallback !== targetTerm) {
        distractors.push(fallback);
      } else {
        distractors.push(`word_${distractors.length + 1}`);
      }
    }

    options = shuffle([targetTerm, ...distractors]);
    correctAnswers = [targetTerm];
  } else if (exType === "MULTI_ANSWER") {
    // Prompt: select all synonyms of [term]
    subPrompt = "Select all synonyms of:";
    prompt = targetTerm;

    // Pick 2-4 correct synonyms
    const numCorrect = Math.min(
      targetSynonyms.length,
      Math.max(2, Math.min(targetSynonyms.length, 3)),
    );
    const chosenCorrect = shuffle(targetSynonyms).slice(0, numCorrect);

    // Pick 2-3 distractors
    const numDistractors = Math.max(2, 5 - chosenCorrect.length);
    const distractors = shuffle(
      otherSynonyms.filter((s) => !targetSynonyms.includes(s)),
    ).slice(0, numDistractors);

    while (distractors.length < numDistractors) {
      const fallback =
        defaultDistractors[distractors.length % defaultDistractors.length];
      if (
        !distractors.includes(fallback) &&
        !chosenCorrect.includes(fallback)
      ) {
        distractors.push(fallback);
      } else {
        distractors.push(`other_${distractors.length + 1}`);
      }
    }

    options = shuffle([...chosenCorrect, ...distractors]);
    correctAnswers = chosenCorrect;
  } else if (exType === "TYPING") {
    subPrompt = "Write one synonym for:";
    prompt = targetTerm;
    correctAnswers = targetSynonyms;
  } else if (exType === "MATCH") {
    subPrompt = "Tap each term and match it with its corresponding synonym:";
    prompt = "Synonym Match Challenge";

    // Build 3-4 pairs from allUserGroups
    const pool = shuffle(allUserGroups).slice(0, 4);
    matchPairs = pool.map((g, pIndex) => ({
      id: `pair_${pIndex}_${g._id}`,
      left: g.term,
      right:
        g.synonyms[Math.floor(Math.random() * g.synonyms.length)]?.word ||
        g.term,
    }));
  }

  return {
    id: `q_${idx}_${group?._id || "none"}`,
    groupId: group ? group._id.toString() : "",
    exerciseType: exType,
    prompt,
    subPrompt,
    meaning: targetMeaning,
    notes: targetNotes,
    options,
    correctAnswers,
    matchPairs,
    allSynonyms: targetSynonyms,
  };
}

export async function startSynonymSession(
  type: SessionType = "DAILY",
): Promise<string> {
  const owner = await ownedScope();
  await connectDB();
  await ensureUserSynonymReviews(owner.userId);

  const allGroups = await SynonymGroup.find(owner).lean();
  if (!allGroups.length) {
    throw new SynonymLearningError(
      "You do not have any synonym groups yet. Add some groups first.",
    );
  }

  const allReviews = await SynonymReview.find({ userId: owner.userId }).lean();
  const reviewMap = new Map<string, SynonymReviewRecord>();
  for (const r of allReviews) {
    reviewMap.set(r.synonymGroupId.toString(), r);
  }

  const now = new Date();
  const dueGroupIds = new Set<string>();
  for (const r of allReviews) {
    if (r.nextReviewAt <= now) {
      dueGroupIds.add(r.synonymGroupId.toString());
    }
  }

  let candidates: typeof allGroups = [];

  if (type === "DUE") {
    candidates = allGroups.filter((g) => dueGroupIds.has(g._id.toString()));
    if (!candidates.length) candidates = allGroups;
  } else if (type === "NEW") {
    candidates = allGroups.filter((g) => g.status === "NEW");
    if (!candidates.length) candidates = allGroups;
  } else if (type === "DIFFICULT") {
    candidates = allGroups.filter((g) => g.status === "DIFFICULT");
    if (!candidates.length) {
      candidates = allGroups.filter((g) => {
        const r = reviewMap.get(g._id.toString());
        return r && r.incorrectCount > 0;
      });
    }
    if (!candidates.length) candidates = allGroups;
  } else {
    // "DAILY" or "CUSTOM": blend due/difficult, new, and other
    const dueOrDiff = allGroups.filter(
      (g) => dueGroupIds.has(g._id.toString()) || g.status === "DIFFICULT",
    );
    const newGroups = allGroups.filter((g) => g.status === "NEW");
    const otherGroups = allGroups.filter(
      (g) => !dueGroupIds.has(g._id.toString()) && g.status !== "NEW",
    );

    const targetDue = Math.min(dueOrDiff.length, 6);
    const targetNew = Math.min(newGroups.length, 4);

    const selectedDue = shuffle(dueOrDiff).slice(0, targetDue);
    const selectedNew = shuffle(newGroups).slice(0, targetNew);
    const combined = [...selectedDue, ...selectedNew];

    if (combined.length < 8) {
      const remaining = 8 - combined.length;
      const combinedIds = new Set(combined.map((g) => g._id.toString()));
      const availableOthers = otherGroups.filter(
        (g) => !combinedIds.has(g._id.toString()),
      );
      combined.push(...shuffle(availableOthers).slice(0, remaining));
    }
    candidates = combined.length > 0 ? combined : allGroups;
  }

  const sessionGroupCount = Math.min(12, Math.max(candidates.length, 1));
  const selectedGroups = shuffle(candidates).slice(0, sessionGroupCount);

  const items: StudySessionItem[] = [];
  selectedGroups.forEach((group, index) => {
    let exerciseType: SynonymExerciseType = "RECOGNITION";

    // Cycle through exercise types
    if (group.synonyms.length >= 2 && index % 4 === 1) {
      exerciseType = "MULTI_ANSWER";
    } else if (index % 4 === 2) {
      exerciseType = "REVERSE_RECOGNITION";
    } else if (index % 4 === 3) {
      exerciseType = "TYPING";
    } else {
      exerciseType = "RECOGNITION";
    }

    items.push({
      synonymGroupId: group._id,
      exerciseType,
      order: index,
      answered: false,
      isCorrect: null,
      retryCount: 0,
    });
  });

  // If user has at least 3 groups, append a MATCH exercise for interactive fun
  if (selectedGroups.length >= 3) {
    items.push({
      synonymGroupId: selectedGroups[0]._id,
      exerciseType: "MATCH",
      order: items.length,
      answered: false,
      isCorrect: null,
      retryCount: 0,
    });
  }

  const session = await StudySession.create({
    userId: owner.userId,
    module: "SYNONYMS",
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

export async function getSynonymStudySession(
  sessionId: string,
): Promise<SynonymSessionDTO> {
  const owner = await ownedScope();
  await connectDB();

  if (!Types.ObjectId.isValid(sessionId)) {
    throw new SynonymLearningError("Invalid session ID");
  }

  const session = await StudySession.findOne({
    _id: sessionId,
    userId: owner.userId,
    module: "SYNONYMS",
  }).lean();

  if (!session) {
    throw new SynonymLearningError("Synonym session not found");
  }

  const allUserGroups = await SynonymGroup.find({
    userId: owner.userId,
  }).lean();

  const groupMap = new Map<
    string,
    SynonymGroupRecord & { _id: Types.ObjectId }
  >();
  for (const g of allUserGroups) {
    groupMap.set(g._id.toString(), g);
  }

  const questions: SynonymQuestionDTO[] = session.items.map((item, idx) => {
    const groupId = item.synonymGroupId?.toString() || "";
    return buildSynonymQuestionDTO(
      item,
      idx,
      groupMap.get(groupId),
      allUserGroups,
    );
  });

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

export async function submitSynonymSessionAnswer(
  sessionId: string,
  questionIndex: number,
  userAnswer: string,
  ratingOverride?: ReviewRating,
) {
  const owner = await ownedScope();
  await connectDB();

  if (!Types.ObjectId.isValid(sessionId)) {
    throw new SynonymLearningError("Invalid session ID");
  }

  const session = await StudySession.findOne({
    _id: sessionId,
    userId: owner.userId,
    module: "SYNONYMS",
  });

  if (!session) {
    throw new SynonymLearningError("Session not found");
  }

  const item = session.items[questionIndex];
  if (!item) {
    throw new SynonymLearningError("Question not found in session");
  }

  const group = await SynonymGroup.findOne({
    _id: item.synonymGroupId,
    userId: owner.userId,
  });

  if (!group) {
    throw new SynonymLearningError("Target synonym group not found");
  }

  // Idempotency: If already answered, return previous result
  if (item.answered) {
    return {
      alreadyAnswered: true,
      isCorrect: item.isCorrect ?? false,
      correctAnswer: group.synonyms.map((s) => s.word).join(", ") || group.term,
      isCompleted: !!session.completedAt,
    };
  }

  // Evaluate correctness based on exercise type
  let isCorrect = false;
  const exType = item.exerciseType as SynonymExerciseType;
  const targetSynonymNorms = new Set(
    group.synonyms.map((s) => normalizeSynonymTerm(s.word)),
  );
  const targetTermNorm = normalizeSynonymTerm(group.term);
  const normalizedUserAns = normalizeSynonymTerm(userAnswer);

  if (exType === "MATCH") {
    isCorrect = userAnswer === "MATCHED" || userAnswer === "CORRECT";
  } else if (exType === "TYPING") {
    // Accepts ANY stored synonym in the group (normalized by case and whitespace)
    isCorrect = targetSynonymNorms.has(normalizedUserAns);
  } else if (exType === "REVERSE_RECOGNITION") {
    // Answer should be the main term
    isCorrect = normalizedUserAns === targetTermNorm;
  } else if (exType === "MULTI_ANSWER") {
    // userAnswer is JSON array string of selected options
    try {
      const selected: string[] = JSON.parse(userAnswer);
      const selectedNorms = new Set(
        selected.map((s) => normalizeSynonymTerm(s)),
      );
      // All selected must be in group synonyms, and at least 1 correct must be picked
      const allSelectedValid = selected.every((s) =>
        targetSynonymNorms.has(normalizeSynonymTerm(s)),
      );
      isCorrect = allSelectedValid && selectedNorms.size > 0;
    } catch {
      isCorrect = targetSynonymNorms.has(normalizedUserAns);
    }
  } else {
    // RECOGNITION: One correct synonym
    isCorrect = targetSynonymNorms.has(normalizedUserAns);
  }

  // Rating
  let rating: ReviewRating;
  if (ratingOverride) {
    rating = ratingOverride;
  } else if (!isCorrect) {
    rating = "AGAIN";
  } else {
    rating = "GOOD";
  }

  // Save attempt
  await SynonymAttempt.create({
    userId: owner.userId,
    synonymGroupId: group._id,
    studySessionId: session._id,
    exerciseType: exType,
    prompt: group.term,
    userAnswer,
    correctAnswer: group.synonyms.map((s) => s.word).join(", "),
    isCorrect,
    rating,
  });

  // Update canonical SynonymReview
  let review = await SynonymReview.findOne({
    userId: owner.userId,
    synonymGroupId: group._id,
  });

  if (!review) {
    review = new SynonymReview({
      userId: owner.userId,
      synonymGroupId: group._id,
      nextReviewAt: group.review?.nextReviewAt || new Date(),
      lastReviewedAt: null,
      intervalDays: group.review?.intervalDays || 0,
      easeFactor: group.review?.easeFactor || 2.5,
      repetitions: group.review?.repetitions || 0,
      correctCount: group.review?.correctCount || 0,
      incorrectCount: group.review?.incorrectCount || 0,
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

  // Update group status and embedded review state
  const nextStatus = calculateNextWordStatus(
    group.status,
    rating,
    reviewResult,
    item.retryCount,
  );
  group.status = nextStatus;
  group.review = {
    nextReviewAt: reviewResult.nextReviewAt,
    lastReviewedAt: reviewResult.lastReviewedAt,
    intervalDays: reviewResult.intervalDays,
    easeFactor: reviewResult.easeFactor,
    repetitions: reviewResult.repetitions,
    correctCount: reviewResult.correctCount,
    incorrectCount: reviewResult.incorrectCount,
  };
  await group.save();

  // Update session progress
  item.answered = true;
  item.isCorrect = isCorrect;
  session.answeredQuestions += 1;
  if (isCorrect) {
    session.correctAnswers += 1;
  } else {
    session.incorrectAnswers += 1;
  }

  // Wrong answer reinsertion: if incorrect and retry count < 2, reinsert later
  let reinsertedQuestion: SynonymQuestionDTO | undefined = undefined;
  let reinsertIndex: number | undefined = undefined;

  if (!isCorrect && item.retryCount < 2 && item.exerciseType !== "MATCH") {
    reinsertIndex = Math.min(session.items.length, questionIndex + 4);
    // Switch exercise type to RECOGNITION for retry clarity
    const retryType: SynonymExerciseType =
      item.exerciseType === "TYPING" ? "RECOGNITION" : "MULTI_ANSWER";

    const newItem: StudySessionItem = {
      synonymGroupId: group._id,
      exerciseType: retryType,
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

    const allUserGroups = await SynonymGroup.find({
      userId: owner.userId,
    }).lean();

    reinsertedQuestion = buildSynonymQuestionDTO(
      newItem,
      reinsertIndex,
      group,
      allUserGroups,
    );
  }

  const allAnswered = session.items.every((it) => it.answered);
  if (allAnswered) {
    session.completedAt = new Date();
  }

  await session.save();

  return {
    alreadyAnswered: false,
    isCorrect,
    correctAnswer: group.synonyms.map((s) => s.word).join(", "),
    rating,
    isCompleted: allAnswered,
    answeredQuestions: session.answeredQuestions,
    totalQuestions: session.totalQuestions,
    reinsertedQuestion,
    reinsertIndex,
  };
}

export async function getSynonymSessionSummary(
  sessionId: string,
): Promise<SynonymSessionSummaryDTO> {
  const owner = await ownedScope();
  await connectDB();

  if (!Types.ObjectId.isValid(sessionId)) {
    throw new SynonymLearningError("Invalid session ID");
  }

  const session = await StudySession.findOne({
    _id: sessionId,
    userId: owner.userId,
    module: "SYNONYMS",
  }).lean();

  if (!session) {
    throw new SynonymLearningError("Session not found");
  }

  const attempts = await SynonymAttempt.find({
    studySessionId: session._id,
    userId: owner.userId,
  }).lean();

  const groupIds = Array.from(
    new Set(attempts.map((a) => a.synonymGroupId.toString())),
  );
  const groups = await SynonymGroup.find({
    _id: { $in: groupIds },
    userId: owner.userId,
  }).lean();
  const groupMap = new Map<string, (typeof groups)[0]>();
  for (const g of groups) groupMap.set(g._id.toString(), g);

  const groupsImproved: SynonymGroupSummaryDTO[] = [];
  const groupsToReview: SynonymGroupSummaryDTO[] = [];

  const groupFailures = new Map<string, number>();
  const groupSuccesses = new Map<string, number>();

  for (const att of attempts) {
    const gid = att.synonymGroupId.toString();
    if (!att.isCorrect) {
      groupFailures.set(gid, (groupFailures.get(gid) || 0) + 1);
    } else {
      groupSuccesses.set(gid, (groupSuccesses.get(gid) || 0) + 1);
    }
  }

  for (const gid of groupIds) {
    const g = groupMap.get(gid);
    if (!g) continue;
    const failures = groupFailures.get(gid) || 0;
    const successes = groupSuccesses.get(gid) || 0;
    const entry: SynonymGroupSummaryDTO = {
      id: g._id.toString(),
      term: g.term,
      meaning: g.meaning,
      synonyms: g.synonyms.map((s) => s.word),
    };
    if (failures > 0) {
      groupsToReview.push(entry);
    } else if (successes > 0) {
      groupsImproved.push(entry);
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
    groupsImproved,
    groupsToReview,
  };
}
