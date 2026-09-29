import "server-only";
import crypto from "crypto";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { ownedScope } from "@/lib/db/ownership";
import { dateKey } from "@/lib/dates";
import { vocabularyTimezone } from "@/lib/vocabulary-timezone";
import { calculateUserStreak } from "./streak";
import { User } from "@/models/user";
import {
  StudySession,
  type StudySessionItem,
  type StudySessionRecord,
} from "@/models/study-session";
import {
  VocabularyWord,
  type VocabularyRecord,
} from "@/models/vocabulary-word";
import {
  VocabularyReview,
  type ReviewRating,
} from "@/models/vocabulary-review";
import {
  VocabularyAttempt,
  type ExerciseType as VocabExerciseType,
} from "@/models/vocabulary-attempt";
import {
  SynonymGroup,
  type SynonymGroupRecord,
  type SynonymEntry,
} from "@/models/synonym-group";
import { SynonymReview } from "@/models/synonym-review";
import {
  SynonymAttempt,
  type SynonymExerciseType,
} from "@/models/synonym-attempt";
import {
  GrammarExercise,
  type GrammarExerciseRecord,
} from "@/models/grammar-exercise";
import { GrammarTopic } from "@/models/grammar-topic";
import { GrammarAttempt } from "@/models/grammar-attempt";
import {
  calculateNextReview,
  calculateNextWordStatus,
} from "@/lib/spaced-repetition";
import { normalizeWord } from "@/features/vocabulary/constants";
import { normalizeSynonymTerm } from "@/features/synonyms/constants";
import {
  isGrammarAnswerAccepted,
  normalizeGrammarAnswer,
} from "@/features/grammar/constants";
import type {
  DailyLearningPlanDTO,
  DailyModuleType,
  DailyPlanItemCandidate,
  DailyQuestionDTO,
  DailySessionStateDTO,
  DailyAnswerSubmissionResult,
  DailySessionSummaryDTO,
} from "@/types/daily-learning";

export class DailyLearningError extends Error {}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const DEFAULT_SYNONYM_DISTRACTORS = [
  "remarkable",
  "frequently",
  "subsequent",
  "beneficial",
  "essential",
  "accurate",
];

/**
 * Deterministic quota redistribution algorithm.
 * Adapts target mix (50% Vocab, 25% Synonyms, 25% Grammar) dynamically
 * based on available items in each module.
 */
export function redistributeQuotas(
  goal: number,
  available: {
    VOCABULARY: number;
    SYNONYMS: number;
    GRAMMAR: number;
  },
): { VOCABULARY: number; SYNONYMS: number; GRAMMAR: number } {
  const totalAvailable =
    available.VOCABULARY + available.SYNONYMS + available.GRAMMAR;
  const targetTotal = Math.min(goal, totalAvailable);

  if (targetTotal <= 0) {
    return { VOCABULARY: 0, SYNONYMS: 0, GRAMMAR: 0 };
  }

  // Base desired ratio: 50% Vocab, 25% Synonyms, 25% Grammar
  const weights: Record<DailyModuleType, number> = {
    VOCABULARY: 0.5,
    SYNONYMS: 0.25,
    GRAMMAR: 0.25,
  };

  const allocated: Record<DailyModuleType, number> = {
    VOCABULARY: 0,
    SYNONYMS: 0,
    GRAMMAR: 0,
  };

  let remaining = targetTotal;
  const modules: DailyModuleType[] = ["VOCABULARY", "SYNONYMS", "GRAMMAR"];

  // Pass 1: Allocate base floor proportional share
  for (const m of modules) {
    const ideal = Math.floor(targetTotal * weights[m]);
    const take = Math.min(ideal, available[m]);
    allocated[m] = take;
    remaining -= take;
  }

  // Pass 2: Distribute remaining items to modules with remaining capacity
  while (remaining > 0) {
    const eligible = modules.filter((m) => allocated[m] < available[m]);
    if (eligible.length === 0) break;

    // Pick eligible module with largest unfulfilled proportion or highest priority
    eligible.sort((a, b) => {
      const aDeficit = targetTotal * weights[a] - allocated[a];
      const bDeficit = targetTotal * weights[b] - allocated[b];
      return bDeficit - aDeficit;
    });

    allocated[eligible[0]] += 1;
    remaining -= 1;
  }

  return allocated;
}

/**
 * Interleave items across modules to avoid long consecutive streaks
 * e.g. V, V, S, G, V, S, V, G...
 */
export function interleaveCandidates(
  vocabCandidates: DailyPlanItemCandidate[],
  synonymCandidates: DailyPlanItemCandidate[],
  grammarCandidates: DailyPlanItemCandidate[],
): DailyPlanItemCandidate[] {
  const queues: Record<DailyModuleType, DailyPlanItemCandidate[]> = {
    VOCABULARY: [...vocabCandidates],
    SYNONYMS: [...synonymCandidates],
    GRAMMAR: [...grammarCandidates],
  };

  const total =
    vocabCandidates.length +
    synonymCandidates.length +
    grammarCandidates.length;
  const result: DailyPlanItemCandidate[] = [];

  // Preferred round-robin cycle: V, V, S, G
  const pattern: DailyModuleType[] = [
    "VOCABULARY",
    "VOCABULARY",
    "SYNONYMS",
    "GRAMMAR",
  ];
  let patternIdx = 0;

  while (result.length < total) {
    let chosen: DailyPlanItemCandidate | undefined = undefined;

    // Try following the target pattern
    for (let attempts = 0; attempts < pattern.length; attempts++) {
      const candidateMod = pattern[(patternIdx + attempts) % pattern.length];
      if (queues[candidateMod].length > 0) {
        chosen = queues[candidateMod].shift();
        patternIdx = (patternIdx + attempts + 1) % pattern.length;
        break;
      }
    }

    // If pattern modules are empty, pick from any remaining module with the most items
    if (!chosen) {
      const remainingMods = (
        ["VOCABULARY", "SYNONYMS", "GRAMMAR"] as DailyModuleType[]
      )
        .filter((m) => queues[m].length > 0)
        .sort((a, b) => queues[b].length - queues[a].length);

      if (remainingMods.length > 0) {
        chosen = queues[remainingMods[0]].shift();
      }
    }

    if (chosen) {
      result.push(chosen);
    } else {
      break;
    }
  }

  return result;
}

/**
 * Builds a deterministic Daily Learning plan for the given user.
 */
export async function buildDailyLearningPlan(
  userIdOverride?: Types.ObjectId,
  options?: { goalOverride?: number; todayDate?: string },
): Promise<DailyLearningPlanDTO> {
  const owner = userIdOverride
    ? { userId: userIdOverride }
    : await ownedScope();
  await connectDB();

  const user = await User.findById(owner.userId)
    .select("dailyQuestionGoal")
    .lean();
  const goal = options?.goalOverride || user?.dailyQuestionGoal || 20;

  const now = new Date();
  const timezone = vocabularyTimezone();
  const studyDate = options?.todayDate || dateKey(now, timezone);

  // 1. Gather Vocabulary Candidates & Priority
  const vocabWords = await VocabularyWord.find({ userId: owner.userId })
    .select("_id word translation status review createdAt")
    .lean();
  const vocabReviews = await VocabularyReview.find({ userId: owner.userId })
    .select("vocabularyWordId nextReviewAt lastReviewedAt")
    .lean();

  const vocabReviewMap = new Map(
    vocabReviews.map((r) => [r.vocabularyWordId.toString(), r]),
  );

  // Recent mistakes for vocab
  const recentVocabMistakes = await VocabularyAttempt.find({
    userId: owner.userId,
    isCorrect: false,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .select("vocabularyWordId")
    .lean();

  const vocabMistakeIds = new Set(
    recentVocabMistakes.map((m) => m.vocabularyWordId.toString()),
  );

  const vocabCandidates: DailyPlanItemCandidate[] = [];
  let vocabDueCount = 0;
  let vocabMistakesCount = 0;
  let vocabNewCount = 0;

  for (const w of vocabWords) {
    const id = w._id.toString();
    const rev = vocabReviewMap.get(id);
    const isDue = rev?.nextReviewAt && rev.nextReviewAt <= now;
    const isMistake = vocabMistakeIds.has(id);
    const isDifficult = w.status === "DIFFICULT";
    const isNew = w.status === "NEW";

    if (isDue) vocabDueCount += 1;
    if (isMistake) vocabMistakesCount += 1;
    if (isNew) vocabNewCount += 1;

    let priorityScore = 10;
    let reason: DailyPlanItemCandidate["reason"] = "REINFORCE";

    if (isDue) {
      const overdueHours = Math.max(
        0,
        (now.getTime() - rev.nextReviewAt.getTime()) / (1000 * 60 * 60),
      );
      priorityScore = 1000 + Math.min(500, Math.round(overdueHours * 10));
      reason = "DUE";
    } else if (isMistake) {
      priorityScore = 800;
      reason = "MISTAKE";
    } else if (isDifficult) {
      priorityScore = 600;
      reason = "DIFFICULT";
    } else if (isNew) {
      priorityScore = 400;
      reason = "NEW";
    }

    vocabCandidates.push({
      module: "VOCABULARY",
      sourceId: id,
      exerciseType: isNew ? "MULTIPLE_CHOICE" : "EN_TO_UZ",
      priorityScore,
      reason,
    });
  }

  // 2. Gather Synonym Candidates & Priority
  const synGroups = await SynonymGroup.find({ userId: owner.userId })
    .select("_id term status synonyms review createdAt")
    .lean();
  const synReviews = await SynonymReview.find({ userId: owner.userId })
    .select("synonymGroupId nextReviewAt lastReviewedAt")
    .lean();

  const synReviewMap = new Map(
    synReviews.map((r) => [r.synonymGroupId.toString(), r]),
  );

  const recentSynMistakes = await SynonymAttempt.find({
    userId: owner.userId,
    isCorrect: false,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .select("synonymGroupId")
    .lean();

  const synMistakeIds = new Set(
    recentSynMistakes.map((m) => m.synonymGroupId.toString()),
  );

  const synCandidates: DailyPlanItemCandidate[] = [];
  let synDueCount = 0;
  let synMistakesCount = 0;
  let synNewCount = 0;

  for (const g of synGroups) {
    const id = g._id.toString();
    const rev = synReviewMap.get(id);
    const isDue = rev?.nextReviewAt && rev.nextReviewAt <= now;
    const isMistake = synMistakeIds.has(id);
    const isDifficult = g.status === "DIFFICULT";
    const isNew = g.status === "NEW";

    if (isDue) synDueCount += 1;
    if (isMistake) synMistakesCount += 1;
    if (isNew) synNewCount += 1;

    let priorityScore = 10;
    let reason: DailyPlanItemCandidate["reason"] = "REINFORCE";

    if (isDue) {
      const overdueHours = Math.max(
        0,
        (now.getTime() - rev.nextReviewAt.getTime()) / (1000 * 60 * 60),
      );
      priorityScore = 1000 + Math.min(500, Math.round(overdueHours * 10));
      reason = "DUE";
    } else if (isMistake) {
      priorityScore = 800;
      reason = "MISTAKE";
    } else if (isDifficult) {
      priorityScore = 600;
      reason = "DIFFICULT";
    } else if (isNew) {
      priorityScore = 400;
      reason = "NEW";
    }

    synCandidates.push({
      module: "SYNONYMS",
      sourceId: id,
      exerciseType: isNew ? "RECOGNITION" : "RECOGNITION",
      priorityScore,
      reason,
    });
  }

  // 3. Gather Grammar Candidates & Priority
  const grammarExercises = await GrammarExercise.find({ userId: owner.userId })
    .select(
      "_id grammarTopicId type question attemptCount correctCount incorrectCount lastAttemptAt lastIsCorrect",
    )
    .lean();

  const recentGrammarMistakes = await GrammarAttempt.find({
    userId: owner.userId,
    isCorrect: false,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .select("grammarExerciseId")
    .lean();

  const grammarMistakeIds = new Set(
    recentGrammarMistakes.map((m) => m.grammarExerciseId.toString()),
  );

  const grammarCandidates: DailyPlanItemCandidate[] = [];
  let grammarMistakesCount = 0;
  let grammarNewCount = 0;

  for (const ex of grammarExercises) {
    const id = ex._id.toString();
    const isMistake = grammarMistakeIds.has(id);
    const isDifficult = ex.incorrectCount > ex.correctCount;
    const isNew = ex.attemptCount === 0;

    if (isMistake) grammarMistakesCount += 1;
    if (isNew) grammarNewCount += 1;

    let priorityScore = 10;
    let reason: DailyPlanItemCandidate["reason"] = "REINFORCE";

    if (isMistake) {
      priorityScore = 800;
      reason = "MISTAKE";
    } else if (isDifficult) {
      priorityScore = 600;
      reason = "DIFFICULT";
    } else if (isNew) {
      priorityScore = 400;
      reason = "NEW";
    }

    grammarCandidates.push({
      module: "GRAMMAR",
      sourceId: id,
      exerciseType: ex.type,
      priorityScore,
      reason,
    });
  }

  // Sort candidates by priority score descending
  vocabCandidates.sort((a, b) => b.priorityScore - a.priorityScore);
  synCandidates.sort((a, b) => b.priorityScore - a.priorityScore);
  grammarCandidates.sort((a, b) => b.priorityScore - a.priorityScore);

  // Compute adaptive quotas
  const quotas = redistributeQuotas(goal, {
    VOCABULARY: vocabCandidates.length,
    SYNONYMS: synCandidates.length,
    GRAMMAR: grammarCandidates.length,
  });

  const totalCount = quotas.VOCABULARY + quotas.SYNONYMS + quotas.GRAMMAR;
  const estimatedMinutes = Math.max(1, Math.round((totalCount * 40) / 60));

  const availableModules: DailyModuleType[] = [];
  if (vocabCandidates.length > 0) availableModules.push("VOCABULARY");
  if (synCandidates.length > 0) availableModules.push("SYNONYMS");
  if (grammarCandidates.length > 0) availableModules.push("GRAMMAR");

  // Check if active session exists for today
  const activeSession = await StudySession.findOne({
    userId: owner.userId,
    module: "MIXED",
    type: "DAILY",
    studyDate,
    completedAt: null,
  })
    .select("_id answeredQuestions totalQuestions")
    .lean();

  return {
    vocabularyCount: quotas.VOCABULARY,
    synonymsCount: quotas.SYNONYMS,
    grammarCount: quotas.GRAMMAR,
    totalCount,
    estimatedMinutes,
    availableModules,
    dueCount: vocabDueCount + synDueCount,
    mistakesCount: vocabMistakesCount + synMistakesCount + grammarMistakesCount,
    newCount: vocabNewCount + synNewCount + grammarNewCount,
    activeSessionId: activeSession ? activeSession._id.toString() : null,
    activeSessionProgress: activeSession
      ? {
          answered: activeSession.answeredQuestions,
          total: activeSession.totalQuestions,
        }
      : null,
  };
}

/**
 * Creates or resumes an active Daily study session for today.
 */
export async function startDailySession(
  userIdOverride?: Types.ObjectId,
  options?: { goalOverride?: number; forceNew?: boolean },
): Promise<string> {
  const owner = userIdOverride
    ? { userId: userIdOverride }
    : await ownedScope();
  await connectDB();

  const timezone = vocabularyTimezone();
  const today = dateKey(new Date(), timezone);

  // 1. Check for existing active session for today
  if (!options?.forceNew) {
    const existingSession = await StudySession.findOne({
      userId: owner.userId,
      module: "MIXED",
      type: "DAILY",
      studyDate: today,
      completedAt: null,
    });

    if (existingSession) {
      return existingSession._id.toString();
    }
  }

  // 2. Build Daily Plan
  const plan = await buildDailyLearningPlan(owner.userId, {
    goalOverride: options?.goalOverride,
    todayDate: today,
  });

  if (plan.totalCount === 0) {
    throw new DailyLearningError(
      "You have nothing to study yet. Add vocabulary, synonyms, or grammar topics first.",
    );
  }

  // Fetch actual candidates according to plan quotas
  const [vocabWords, synGroups, grammarExercises] = await Promise.all([
    plan.vocabularyCount > 0
      ? VocabularyWord.find({ userId: owner.userId })
          .select("_id status")
          .lean()
      : Promise.resolve([]),
    plan.synonymsCount > 0
      ? SynonymGroup.find({ userId: owner.userId }).select("_id status").lean()
      : Promise.resolve([]),
    plan.grammarCount > 0
      ? GrammarExercise.find({ userId: owner.userId })
          .select("_id type incorrectCount correctCount attemptCount")
          .lean()
      : Promise.resolve([]),
  ]);

  // Priority scoring for selected items
  const now = new Date();
  const vocabReviews = await VocabularyReview.find({
    userId: owner.userId,
    vocabularyWordId: { $in: vocabWords.map((w) => w._id) },
  }).lean();
  const vocabReviewMap = new Map(
    vocabReviews.map((r) => [r.vocabularyWordId.toString(), r]),
  );

  const selectedVocab = vocabWords
    .map((w) => {
      const rev = vocabReviewMap.get(w._id.toString());
      const isDue = rev?.nextReviewAt && rev.nextReviewAt <= now;
      let score = 10;
      if (isDue) score = 1000;
      else if (w.status === "DIFFICULT") score = 600;
      else if (w.status === "NEW") score = 400;
      return {
        module: "VOCABULARY" as const,
        sourceId: w._id.toString(),
        exerciseType: w.status === "NEW" ? "MULTIPLE_CHOICE" : "EN_TO_UZ",
        priorityScore: score,
        reason: (isDue
          ? "DUE"
          : w.status === "NEW"
            ? "NEW"
            : "REINFORCE") as DailyPlanItemCandidate["reason"],
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, plan.vocabularyCount);

  const synReviews = await SynonymReview.find({
    userId: owner.userId,
    synonymGroupId: { $in: synGroups.map((g) => g._id) },
  }).lean();
  const synReviewMap = new Map(
    synReviews.map((r) => [r.synonymGroupId.toString(), r]),
  );

  const selectedSyn = synGroups
    .map((g) => {
      const rev = synReviewMap.get(g._id.toString());
      const isDue = rev?.nextReviewAt && rev.nextReviewAt <= now;
      let score = 10;
      if (isDue) score = 1000;
      else if (g.status === "DIFFICULT") score = 600;
      else if (g.status === "NEW") score = 400;
      return {
        module: "SYNONYMS" as const,
        sourceId: g._id.toString(),
        exerciseType: "RECOGNITION",
        priorityScore: score,
        reason: (isDue
          ? "DUE"
          : g.status === "NEW"
            ? "NEW"
            : "REINFORCE") as DailyPlanItemCandidate["reason"],
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, plan.synonymsCount);

  const selectedGrammar = grammarExercises
    .map((ex) => {
      let score = 10;
      if (ex.incorrectCount > ex.correctCount) score = 600;
      else if (ex.attemptCount === 0) score = 400;
      return {
        module: "GRAMMAR" as const,
        sourceId: ex._id.toString(),
        exerciseType: ex.type,
        priorityScore: score,
        reason: (ex.attemptCount === 0
          ? "NEW"
          : "REINFORCE") as DailyPlanItemCandidate["reason"],
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, plan.grammarCount);

  // Interleave questions
  const interleaved = interleaveCandidates(
    selectedVocab,
    selectedSyn,
    selectedGrammar,
  );

  // Map to StudySessionItems with stable sessionItemId
  const sessionItems: StudySessionItem[] = interleaved.map((item, idx) => ({
    sessionItemId: crypto.randomUUID(),
    module: item.module,
    vocabularyWordId:
      item.module === "VOCABULARY"
        ? new Types.ObjectId(item.sourceId)
        : undefined,
    synonymGroupId:
      item.module === "SYNONYMS"
        ? new Types.ObjectId(item.sourceId)
        : undefined,
    grammarExerciseId:
      item.module === "GRAMMAR" ? new Types.ObjectId(item.sourceId) : undefined,
    exerciseType: item.exerciseType,
    order: idx,
    answered: false,
    isCorrect: null,
    retryCount: 0,
  }));

  const session = await StudySession.create({
    userId: owner.userId,
    module: "MIXED",
    type: "DAILY",
    studyDate: today,
    startedAt: new Date(),
    totalQuestions: sessionItems.length,
    plannedQuestions: sessionItems.length,
    answeredQuestions: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    activeStudySeconds: 0,
    moduleBreakdown: {
      vocabulary: { total: 0, correct: 0, incorrect: 0 },
      synonyms: { total: 0, correct: 0, incorrect: 0 },
      grammar: { total: 0, correct: 0, incorrect: 0 },
    },
    items: sessionItems,
  });

  return session._id.toString();
}

/**
 * Loads the current state of a Daily (or Mixed) session for the runner.
 */
export async function getDailySessionState(
  sessionId: string,
  userIdOverride?: Types.ObjectId,
): Promise<DailySessionStateDTO> {
  const owner = userIdOverride
    ? { userId: userIdOverride }
    : await ownedScope();
  await connectDB();

  if (!Types.ObjectId.isValid(sessionId)) {
    throw new DailyLearningError("Invalid session ID");
  }

  const session = await StudySession.findOne({
    _id: new Types.ObjectId(sessionId),
    userId: owner.userId,
  }).lean<StudySessionRecord>();

  if (!session) {
    throw new DailyLearningError("Session not found");
  }

  // Fetch all vocabulary words in this session + distractors
  const vocabIds = session.items
    .filter((i) => i.module === "VOCABULARY" && i.vocabularyWordId)
    .map((i) => i.vocabularyWordId as Types.ObjectId);

  const [sessionVocabWords, allUserVocab] = await Promise.all([
    vocabIds.length > 0
      ? VocabularyWord.find({
          _id: { $in: vocabIds },
          userId: owner.userId,
        }).lean()
      : Promise.resolve([]),
    VocabularyWord.find({ userId: owner.userId })
      .select("word translation")
      .lean(),
  ]);

  const vocabMap = new Map(sessionVocabWords.map((w) => [w._id.toString(), w]));
  const allTranslations = Array.from(
    new Set(allUserVocab.map((w) => w.translation.trim())),
  );
  const allEnglishWords = Array.from(
    new Set(allUserVocab.map((w) => w.word.trim())),
  );

  // Fetch all synonym groups in this session
  const synIds = session.items
    .filter((i) => i.module === "SYNONYMS" && i.synonymGroupId)
    .map((i) => i.synonymGroupId as Types.ObjectId);

  const [sessionSynGroups, allUserSynGroups] = await Promise.all([
    synIds.length > 0
      ? SynonymGroup.find({
          _id: { $in: synIds },
          userId: owner.userId,
        }).lean()
      : Promise.resolve([]),
    SynonymGroup.find({ userId: owner.userId }).select("term synonyms").lean(),
  ]);

  const synMap = new Map(sessionSynGroups.map((g) => [g._id.toString(), g]));

  // Distractors for synonyms
  const otherSynonyms: string[] = [];
  for (const g of allUserSynGroups) {
    for (const s of g.synonyms) {
      otherSynonyms.push(s.word);
    }
  }

  // Fetch all grammar exercises in this session
  const grammarIds = session.items
    .filter((i) => i.module === "GRAMMAR" && i.grammarExerciseId)
    .map((i) => i.grammarExerciseId as Types.ObjectId);

  const sessionGrammarExercises =
    grammarIds.length > 0
      ? await GrammarExercise.find({
          _id: { $in: grammarIds },
          userId: owner.userId,
        }).lean()
      : [];

  const grammarMap = new Map(
    sessionGrammarExercises.map((e) => [e._id.toString(), e]),
  );

  const topicIds = Array.from(
    new Set(sessionGrammarExercises.map((e) => e.grammarTopicId.toString())),
  );
  const topics =
    topicIds.length > 0
      ? await GrammarTopic.find({
          _id: { $in: topicIds },
          userId: owner.userId,
        })
          .select("title")
          .lean()
      : [];
  const topicMap = new Map(topics.map((t) => [t._id.toString(), t.title]));

  // Build question DTOs
  const questions: DailyQuestionDTO[] = session.items.map((item, idx) => {
    const sessionItemId = item.sessionItemId || `item_${idx}`;
    const itemModule = item.module || "VOCABULARY";

    if (itemModule === "VOCABULARY") {
      const word = vocabMap.get(item.vocabularyWordId?.toString() || "");
      const targetWord = word?.word || "Word";
      const targetTranslation = word?.translation || "Translation";

      let prompt = targetWord;
      let subPrompt = "Choose the correct translation";
      let options: string[] | undefined = undefined;

      if (
        item.exerciseType === "MULTIPLE_CHOICE" ||
        item.exerciseType === "EN_TO_UZ"
      ) {
        prompt = targetWord;
        subPrompt = "Choose the correct translation";
        const distractors = shuffle(
          allTranslations.filter(
            (t) => t.toLowerCase() !== targetTranslation.toLowerCase(),
          ),
        ).slice(0, 3);
        options = shuffle([targetTranslation, ...distractors]);
      } else if (item.exerciseType === "UZ_TO_EN") {
        prompt = targetTranslation;
        subPrompt = "Choose the correct English word";
        const distractors = shuffle(
          allEnglishWords.filter(
            (w) => w.toLowerCase() !== targetWord.toLowerCase(),
          ),
        ).slice(0, 3);
        options = shuffle([targetWord, ...distractors]);
      } else {
        // TYPING or fallback
        prompt = targetTranslation;
        subPrompt = "Type the English word";
      }

      return {
        sessionItemId,
        order: idx,
        module: "VOCABULARY",
        exerciseType: item.exerciseType,
        type: item.exerciseType,
        sourceId: item.vocabularyWordId?.toString() || "",
        exerciseId: item.vocabularyWordId?.toString() || "",
        prompt,
        question: prompt,
        subPrompt,
        options,
        correctAnswers: item.answered
          ? [targetTranslation, targetWord]
          : undefined,
        isAnswered: item.answered,
        isCorrect: item.isCorrect,
      };
    } else if (itemModule === "SYNONYMS") {
      const group = synMap.get(item.synonymGroupId?.toString() || "");
      const term = group?.term || "Term";
      const targetSynonyms = group?.synonyms.map((s) => s.word) || [];
      const primarySynonym = targetSynonyms[0] || term;

      const distractors = shuffle(
        otherSynonyms.filter(
          (s) =>
            !targetSynonyms.some(
              (ts) => ts.toLowerCase() === s.toLowerCase(),
            ) && s.toLowerCase() !== term.toLowerCase(),
        ),
      ).slice(0, 3);

      while (distractors.length < 3) {
        const fallback =
          DEFAULT_SYNONYM_DISTRACTORS[
            distractors.length % DEFAULT_SYNONYM_DISTRACTORS.length
          ];
        if (!distractors.includes(fallback)) distractors.push(fallback);
        else break;
      }

      const options = shuffle([primarySynonym, ...distractors]);

      return {
        sessionItemId,
        order: idx,
        module: "SYNONYMS",
        exerciseType: item.exerciseType || "RECOGNITION",
        type: item.exerciseType || "RECOGNITION",
        sourceId: item.synonymGroupId?.toString() || "",
        exerciseId: item.synonymGroupId?.toString() || "",
        prompt: term,
        question: term,
        subPrompt: "Select the most accurate synonym",
        options,
        correctAnswers: item.answered
          ? targetSynonyms.length > 0
            ? targetSynonyms
            : [term]
          : undefined,
        notes: group?.notes || undefined,
        isAnswered: item.answered,
        isCorrect: item.isCorrect,
      };
    } else {
      // GRAMMAR
      const ex = grammarMap.get(item.grammarExerciseId?.toString() || "");
      const topicTitle =
        topicMap.get(ex?.grammarTopicId?.toString() || "") ||
        "Grammar Practice";
      const exType = ex?.type || item.exerciseType || "MULTIPLE_CHOICE";

      let options: string[] | undefined =
        ex?.options && ex.options.length > 0 ? [...ex.options] : undefined;
      if (exType === "TRUE_FALSE") {
        options = ["True", "False"];
      }

      return {
        sessionItemId,
        order: idx,
        module: "GRAMMAR",
        exerciseType: exType,
        type: exType,
        sourceId: item.grammarExerciseId?.toString() || "",
        exerciseId: item.grammarExerciseId?.toString() || "",
        grammarTopicId: ex?.grammarTopicId?.toString(),
        prompt: ex?.question || "Exercise question",
        question: ex?.question || "Exercise question",
        subPrompt: topicTitle,
        topicTitle,
        options,
        correctAnswers: item.answered ? [ex?.correctAnswer || ""] : undefined,
        explanation: item.answered ? ex?.explanation || "" : undefined,
        isAnswered: item.answered,
        isCorrect: item.isCorrect,
      };
    }
  });

  const nextUnanswered = session.items.findIndex((i) => !i.answered);
  const currentIndex =
    nextUnanswered === -1 ? session.items.length - 1 : nextUnanswered;
  const isCompleted =
    !!session.completedAt ||
    session.items.length === 0 ||
    session.items.every((i) => i.answered);

  return {
    id: session._id.toString(),
    module: "MIXED",
    type: (session.type === "MISTAKES" ? "MISTAKES" : "DAILY") as
      "DAILY" | "MISTAKES",
    studyDate: session.studyDate,
    totalQuestions: session.totalQuestions,
    plannedQuestions: session.plannedQuestions || session.totalQuestions,
    answeredQuestions: session.answeredQuestions,
    correctAnswers: session.correctAnswers,
    incorrectAnswers: session.incorrectAnswers,
    activeStudySeconds: session.activeStudySeconds || 0,
    isCompleted,
    completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    currentIndex: Math.max(0, currentIndex),
    questions,
    moduleBreakdown: session.moduleBreakdown || {
      vocabulary: { total: 0, correct: 0, incorrect: 0 },
      synonyms: { total: 0, correct: 0, incorrect: 0 },
      grammar: { total: 0, correct: 0, incorrect: 0 },
    },
  };
}

/**
 * Submits an answer for a specific question in a Daily session.
 * Protects against index shifts with stable sessionItemId.
 */
export async function submitDailyAnswer(
  sessionId: string,
  sessionItemId: string,
  answer: string,
  activeSeconds: number = 5,
  userIdOverride?: Types.ObjectId,
): Promise<DailyAnswerSubmissionResult> {
  const owner = userIdOverride
    ? { userId: userIdOverride }
    : await ownedScope();
  await connectDB();

  if (!Types.ObjectId.isValid(sessionId)) {
    throw new DailyLearningError("Invalid session ID");
  }

  const session = await StudySession.findOne({
    _id: new Types.ObjectId(sessionId),
    userId: owner.userId,
  });

  if (!session) {
    throw new DailyLearningError("Session not found");
  }

  if (session.completedAt) {
    throw new DailyLearningError("This session has already ended.");
  }

  // 1. Locate item by stable sessionItemId
  const itemIndex = session.items.findIndex(
    (i) => i.sessionItemId === sessionItemId,
  );
  if (itemIndex === -1) {
    throw new DailyLearningError("Question not found in session.");
  }

  const item = session.items[itemIndex];

  // Idempotency: If already answered, return previous state safely
  if (item.answered) {
    return {
      alreadyAnswered: true,
      isCorrect: item.isCorrect ?? false,
      correctAnswer: "",
      isCompleted: !!session.completedAt,
      answeredQuestions: session.answeredQuestions,
      totalQuestions: session.totalQuestions,
      activeStudySeconds: session.activeStudySeconds || 0,
      moduleBreakdown: session.moduleBreakdown || {
        vocabulary: { total: 0, correct: 0, incorrect: 0 },
        synonyms: { total: 0, correct: 0, incorrect: 0 },
        grammar: { total: 0, correct: 0, incorrect: 0 },
      },
    };
  }

  const moduleType = item.module || "VOCABULARY";
  let isCorrect = false;
  let correctAnswerText = "";
  let explanationText: string | undefined = undefined;

  // Track active study time with safe bounds (1 - 120 seconds)
  const boundedSeconds = Math.max(1, Math.min(120, activeSeconds));
  session.activeStudySeconds =
    (session.activeStudySeconds || 0) + boundedSeconds;

  // Initialize moduleBreakdown if missing
  if (!session.moduleBreakdown) {
    session.moduleBreakdown = {
      vocabulary: { total: 0, correct: 0, incorrect: 0 },
      synonyms: { total: 0, correct: 0, incorrect: 0 },
      grammar: { total: 0, correct: 0, incorrect: 0 },
    };
  }

  // 2. Evaluate Answer according to module
  let vocabWordDoc: VocabularyRecord | null = null;
  let synGroupDoc: SynonymGroupRecord | null = null;
  let grammarExerciseDoc: GrammarExerciseRecord | null = null;

  if (moduleType === "VOCABULARY") {
    const word = await VocabularyWord.findOne({
      _id: item.vocabularyWordId,
      userId: owner.userId,
    });
    if (!word) throw new DailyLearningError("Vocabulary word not found");
    vocabWordDoc = word;

    const targetWord = word.word.trim();
    const targetTranslation = word.translation.trim();
    const normalizedAns = normalizeWord(answer);

    if (
      item.exerciseType === "UZ_TO_EN" ||
      item.exerciseType === "TYPING" ||
      item.exerciseType === "FILL_BLANK"
    ) {
      isCorrect = normalizedAns === normalizeWord(targetWord);
      correctAnswerText = targetWord;
    } else {
      isCorrect =
        normalizedAns === normalizeWord(targetTranslation) ||
        answer.trim().toLowerCase() === targetTranslation.toLowerCase();
      correctAnswerText = targetTranslation;
    }

    const rating: ReviewRating = isCorrect ? "GOOD" : "AGAIN";

    // Record VocabularyAttempt
    await VocabularyAttempt.create({
      userId: owner.userId,
      vocabularyWordId: word._id,
      studySessionId: session._id,
      exerciseType: item.exerciseType as VocabExerciseType,
      prompt:
        item.exerciseType === "UZ_TO_EN" || item.exerciseType === "TYPING"
          ? targetTranslation
          : targetWord,
      userAnswer: answer,
      correctAnswer: correctAnswerText,
      isCorrect,
      rating,
    });

    // Update VocabularyReview & Word
    let review = await VocabularyReview.findOne({
      userId: owner.userId,
      vocabularyWordId: word._id,
    });
    if (!review) {
      review = new VocabularyReview({
        userId: owner.userId,
        vocabularyWordId: word._id,
        nextReviewAt: word.review?.nextReviewAt || new Date(),
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

    session.moduleBreakdown.vocabulary.total += 1;
    if (isCorrect) session.moduleBreakdown.vocabulary.correct += 1;
    else session.moduleBreakdown.vocabulary.incorrect += 1;
  } else if (moduleType === "SYNONYMS") {
    const group = await SynonymGroup.findOne({
      _id: item.synonymGroupId,
      userId: owner.userId,
    });
    if (!group) throw new DailyLearningError("Synonym group not found");
    synGroupDoc = group;

    const targetSynonymNorms = new Set(
      group.synonyms.map((s) => normalizeSynonymTerm(s.word)),
    );
    const targetTermNorm = normalizeSynonymTerm(group.term);
    const normalizedUserAns = normalizeSynonymTerm(answer);

    if (item.exerciseType === "REVERSE_RECOGNITION") {
      isCorrect = normalizedUserAns === targetTermNorm;
      correctAnswerText = group.term;
    } else {
      isCorrect = targetSynonymNorms.has(normalizedUserAns);
      correctAnswerText =
        group.synonyms.map((s) => s.word).join(", ") || group.term;
    }

    const rating: ReviewRating = isCorrect ? "GOOD" : "AGAIN";

    // Record SynonymAttempt
    await SynonymAttempt.create({
      userId: owner.userId,
      synonymGroupId: group._id,
      studySessionId: session._id,
      exerciseType: item.exerciseType as SynonymExerciseType,
      prompt: group.term,
      userAnswer: answer,
      correctAnswer: correctAnswerText,
      isCorrect,
      rating,
    });

    // Update SynonymReview & Group
    let review = await SynonymReview.findOne({
      userId: owner.userId,
      synonymGroupId: group._id,
    });
    if (!review) {
      review = new SynonymReview({
        userId: owner.userId,
        synonymGroupId: group._id,
        nextReviewAt: group.review?.nextReviewAt || new Date(),
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

    session.moduleBreakdown.synonyms.total += 1;
    if (isCorrect) session.moduleBreakdown.synonyms.correct += 1;
    else session.moduleBreakdown.synonyms.incorrect += 1;
  } else {
    // GRAMMAR
    const exercise = await GrammarExercise.findOne({
      _id: item.grammarExerciseId,
      userId: owner.userId,
    });
    if (!exercise) throw new DailyLearningError("Grammar exercise not found");
    grammarExerciseDoc = exercise;

    isCorrect = isGrammarAnswerAccepted(
      answer,
      exercise.correctAnswer,
      exercise.acceptedAnswers,
      exercise.type,
    );
    correctAnswerText = exercise.correctAnswer;
    explanationText = exercise.explanation;

    // Record GrammarAttempt
    await GrammarAttempt.create({
      userId: owner.userId,
      grammarTopicId: exercise.grammarTopicId,
      grammarExerciseId: exercise._id,
      studySessionId: session._id,
      exerciseType: exercise.type,
      prompt: exercise.question,
      userAnswer: answer,
      normalizedAnswer: normalizeGrammarAnswer(answer),
      correctAnswer: exercise.correctAnswer,
      isCorrect,
    });

    // Update GrammarExercise mastery
    exercise.attemptCount += 1;
    if (isCorrect) exercise.correctCount += 1;
    else exercise.incorrectCount += 1;
    exercise.lastAttemptAt = new Date();
    exercise.lastIsCorrect = isCorrect;
    await exercise.save();

    session.moduleBreakdown.grammar.total += 1;
    if (isCorrect) session.moduleBreakdown.grammar.correct += 1;
    else session.moduleBreakdown.grammar.incorrect += 1;
  }

  // 3. Update session item
  item.answered = true;
  item.isCorrect = isCorrect;
  item.answeredAt = new Date();
  session.answeredQuestions += 1;
  if (isCorrect) session.correctAnswers += 1;
  else session.incorrectAnswers += 1;

  // 4. Wrong Answer Reinsertion (if incorrect and retryCount < 2)
  let reinsertedQuestion: DailyQuestionDTO | undefined = undefined;
  let reinsertIndex: number | undefined = undefined;

  if (!isCorrect && item.retryCount < 2) {
    reinsertIndex = Math.min(session.items.length, itemIndex + 4);
    const newSessionItemId = crypto.randomUUID();

    const newItem: StudySessionItem = {
      sessionItemId: newSessionItemId,
      module: item.module,
      vocabularyWordId: item.vocabularyWordId,
      synonymGroupId: item.synonymGroupId,
      grammarExerciseId: item.grammarExerciseId,
      exerciseType: item.exerciseType,
      order: reinsertIndex,
      answered: false,
      isCorrect: null,
      retryCount: item.retryCount + 1,
      retryOfItemId: item.sessionItemId,
    };

    session.items.splice(reinsertIndex, 0, newItem);
    session.totalQuestions = session.items.length;
    session.items.forEach((it, i) => {
      it.order = i;
    });

    // Construct reinserted question DTO for client
    if (moduleType === "GRAMMAR") {
      const exercise = grammarExerciseDoc;
      const topic = exercise?.grammarTopicId
        ? await GrammarTopic.findOne({
            _id: exercise.grammarTopicId,
            userId: owner.userId,
          })
            .select("title")
            .lean()
        : null;

      const topicTitle = topic?.title || "Grammar Practice";
      const exType = exercise?.type || item.exerciseType || "MULTIPLE_CHOICE";

      let options: string[] | undefined =
        exercise?.options && exercise.options.length > 0
          ? [...exercise.options]
          : undefined;
      if (exType === "TRUE_FALSE") {
        options = ["True", "False"];
      }

      reinsertedQuestion = {
        sessionItemId: newSessionItemId,
        order: reinsertIndex,
        module: "GRAMMAR",
        exerciseType: exType,
        type: exType,
        sourceId: (item.grammarExerciseId || "").toString(),
        exerciseId: (item.grammarExerciseId || "").toString(),
        grammarTopicId: exercise?.grammarTopicId?.toString(),
        topicTitle,
        prompt: exercise?.question || "Exercise question",
        question: exercise?.question || "Exercise question",
        subPrompt: topicTitle,
        options,
        isAnswered: false,
        isCorrect: null,
      };
    } else if (moduleType === "SYNONYMS") {
      const group = synGroupDoc;
      const term = group?.term || "Term";
      const targetSynonyms = (group?.synonyms || []).map(
        (s: SynonymEntry) => s.word,
      );
      const primarySynonym = targetSynonyms[0] || term;

      const otherGroups = await SynonymGroup.find({
        userId: owner.userId,
        _id: { $ne: item.synonymGroupId },
      })
        .select("synonyms term")
        .limit(10)
        .lean();

      const otherSynWords = otherGroups.flatMap((g) => [
        g.term,
        ...(g.synonyms || []).map((s: SynonymEntry) => s.word),
      ]);

      const distractors = shuffle(
        otherSynWords.filter(
          (s: string) =>
            !targetSynonyms.some(
              (ts: string) => ts.toLowerCase() === s.toLowerCase(),
            ) && s.toLowerCase() !== term.toLowerCase(),
        ),
      ).slice(0, 3);

      while (distractors.length < 3) {
        const fallback =
          DEFAULT_SYNONYM_DISTRACTORS[
            distractors.length % DEFAULT_SYNONYM_DISTRACTORS.length
          ];
        if (!distractors.includes(fallback)) distractors.push(fallback);
        else break;
      }

      const options = shuffle([primarySynonym, ...distractors]);

      reinsertedQuestion = {
        sessionItemId: newSessionItemId,
        order: reinsertIndex,
        module: "SYNONYMS",
        exerciseType: item.exerciseType || "RECOGNITION",
        type: item.exerciseType || "RECOGNITION",
        sourceId: (item.synonymGroupId || "").toString(),
        exerciseId: (item.synonymGroupId || "").toString(),
        prompt: term,
        question: term,
        subPrompt: "Select the most accurate synonym",
        options,
        notes: group?.notes || undefined,
        isAnswered: false,
        isCorrect: null,
      };
    } else {
      // VOCABULARY
      const word = vocabWordDoc;
      const targetWord = (word?.word || "Word").trim();
      const targetTranslation = (word?.translation || "Translation").trim();

      let prompt = targetWord;
      let subPrompt = "Choose the correct translation";
      let options: string[] | undefined = undefined;

      if (
        item.exerciseType === "MULTIPLE_CHOICE" ||
        item.exerciseType === "EN_TO_UZ"
      ) {
        prompt = targetWord;
        subPrompt = "Choose the correct translation";
        const otherWords = await VocabularyWord.find({
          userId: owner.userId,
          _id: { $ne: item.vocabularyWordId },
        })
          .select("translation")
          .limit(10)
          .lean();
        const distractors = shuffle(
          otherWords
            .map((w) => w.translation)
            .filter((t) => t.toLowerCase() !== targetTranslation.toLowerCase()),
        ).slice(0, 3);
        options = shuffle([targetTranslation, ...distractors]);
      } else if (item.exerciseType === "UZ_TO_EN") {
        prompt = targetTranslation;
        subPrompt = "Choose the correct English word";
        const otherWords = await VocabularyWord.find({
          userId: owner.userId,
          _id: { $ne: item.vocabularyWordId },
        })
          .select("word")
          .limit(10)
          .lean();
        const distractors = shuffle(
          otherWords
            .map((w) => w.word)
            .filter((w) => w.toLowerCase() !== targetWord.toLowerCase()),
        ).slice(0, 3);
        options = shuffle([targetWord, ...distractors]);
      } else {
        prompt = targetTranslation;
        subPrompt = "Type the English word";
      }

      reinsertedQuestion = {
        sessionItemId: newSessionItemId,
        order: reinsertIndex,
        module: "VOCABULARY",
        exerciseType: item.exerciseType,
        type: item.exerciseType,
        sourceId: (item.vocabularyWordId || "").toString(),
        exerciseId: (item.vocabularyWordId || "").toString(),
        prompt,
        question: prompt,
        subPrompt,
        options,
        isAnswered: false,
        isCorrect: null,
      };
    }
  }

  // 5. Check completion
  const isCompleted = session.items.every((it) => it.answered);
  if (isCompleted) {
    session.completedAt = new Date();
  }

  session.markModified("items");
  await session.save();

  return {
    alreadyAnswered: false,
    isCorrect,
    correctAnswer: correctAnswerText,
    explanation: explanationText,
    isCompleted,
    answeredQuestions: session.answeredQuestions,
    totalQuestions: session.totalQuestions,
    activeStudySeconds: session.activeStudySeconds || 0,
    reinsertedQuestion,
    reinsertIndex,
    moduleBreakdown: session.moduleBreakdown,
  };
}

/**
 * Returns summary of a completed Daily session.
 */
export async function getDailySessionSummary(
  sessionId: string,
  userIdOverride?: Types.ObjectId,
): Promise<DailySessionSummaryDTO> {
  const owner = userIdOverride
    ? { userId: userIdOverride }
    : await ownedScope();
  await connectDB();

  if (!Types.ObjectId.isValid(sessionId)) {
    throw new DailyLearningError("Invalid session ID");
  }

  const session = await StudySession.findOne({
    _id: new Types.ObjectId(sessionId),
    userId: owner.userId,
  }).lean<StudySessionRecord>();

  if (!session) {
    throw new DailyLearningError("Session not found");
  }

  const total = session.answeredQuestions || 1;
  const overallAccuracy = Math.round(
    ((session.correctAnswers || 0) / total) * 100,
  );

  const streak = await calculateUserStreak(owner.userId);

  const bd = session.moduleBreakdown || {
    vocabulary: { total: 0, correct: 0, incorrect: 0 },
    synonyms: { total: 0, correct: 0, incorrect: 0 },
    grammar: { total: 0, correct: 0, incorrect: 0 },
  };

  const calcAcc = (m: { total: number; correct: number }) =>
    m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0;

  return {
    sessionId: session._id.toString(),
    type: session.type,
    studyDate: session.studyDate,
    plannedQuestions: session.plannedQuestions || session.totalQuestions,
    answeredQuestions: session.answeredQuestions,
    correctAnswers: session.correctAnswers,
    incorrectAnswers: session.incorrectAnswers,
    overallAccuracy,
    activeStudySeconds: session.activeStudySeconds || 0,
    activeStudyMinutes: Math.max(
      1,
      Math.round((session.activeStudySeconds || 0) / 60),
    ),
    currentStreak: streak,
    moduleBreakdown: {
      vocabulary: {
        ...bd.vocabulary,
        accuracy: calcAcc(bd.vocabulary),
      },
      synonyms: {
        ...bd.synonyms,
        accuracy: calcAcc(bd.synonyms),
      },
      grammar: {
        ...bd.grammar,
        accuracy: calcAcc(bd.grammar),
      },
    },
    mistakesCount: session.incorrectAnswers,
  };
}
