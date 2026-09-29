import "server-only";
import crypto from "crypto";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { ownedScope } from "@/lib/db/ownership";
import { VocabularyAttempt } from "@/models/vocabulary-attempt";
import { VocabularyWord } from "@/models/vocabulary-word";
import { SynonymAttempt } from "@/models/synonym-attempt";
import { SynonymGroup } from "@/models/synonym-group";
import { GrammarAttempt } from "@/models/grammar-attempt";
import { GrammarExercise } from "@/models/grammar-exercise";
import { GrammarTopic } from "@/models/grammar-topic";
import { StudySession, type StudySessionItem } from "@/models/study-session";
import { interleaveCandidates } from "./daily-learning";
import type { DailyPlanItemCandidate } from "@/types/daily-learning";
import type {
  MistakeSortFilter,
  MistakeTabFilter,
  UnifiedMistakeItemDTO,
  UnifiedMistakesSummaryDTO,
} from "@/types/mistakes";

export class MistakesError extends Error {}

/**
 * Deterministic mistake resolution check:
 * - If latest attempt was incorrect -> UNRESOLVED (false)
 * - If last 2 consecutive attempts were correct -> RESOLVED (true)
 * - Otherwise UNRESOLVED (false)
 */
export function isMistakeResolved(
  attemptsSortedDesc: Array<{ isCorrect: boolean }>,
): boolean {
  if (attemptsSortedDesc.length === 0) return true;
  if (!attemptsSortedDesc[0].isCorrect) return false;
  if (attemptsSortedDesc.length >= 2) {
    return attemptsSortedDesc[0].isCorrect && attemptsSortedDesc[1].isCorrect;
  }
  return false;
}

/**
 * Aggregates mistakes across Vocabulary, Synonyms, and Grammar.
 */
export async function getUnifiedMistakes(
  userIdOverride?: Types.ObjectId,
  filters?: {
    module?: MistakeTabFilter;
    sort?: MistakeSortFilter;
  },
): Promise<UnifiedMistakesSummaryDTO> {
  const owner = userIdOverride
    ? { userId: userIdOverride }
    : await ownedScope();
  await connectDB();

  const moduleFilter = filters?.module || "ALL";
  const sortFilter = filters?.sort || "UNRESOLVED";

  // 1. Vocabulary Mistakes
  const vocabMistakeItems: UnifiedMistakeItemDTO[] = [];
  if (moduleFilter === "ALL" || moduleFilter === "VOCABULARY") {
    // Find words with at least one incorrect attempt
    const distinctVocabIds = await VocabularyAttempt.distinct(
      "vocabularyWordId",
      {
        userId: owner.userId,
        isCorrect: false,
      },
    );

    if (distinctVocabIds.length > 0) {
      const [words, allAttempts] = await Promise.all([
        VocabularyWord.find({
          _id: { $in: distinctVocabIds },
          userId: owner.userId,
        })
          .select("word translation")
          .lean(),
        VocabularyAttempt.find({
          userId: owner.userId,
          vocabularyWordId: { $in: distinctVocabIds },
        })
          .sort({ createdAt: -1 })
          .select(
            "vocabularyWordId isCorrect userAnswer correctAnswer createdAt",
          )
          .lean(),
      ]);

      const wordMap = new Map(words.map((w) => [w._id.toString(), w]));

      // Group attempts by wordId
      const attemptsByWord = new Map<string, typeof allAttempts>();
      for (const a of allAttempts) {
        const id = a.vocabularyWordId.toString();
        const list = attemptsByWord.get(id) || [];
        list.push(a);
        attemptsByWord.set(id, list);
      }

      for (const [id, attempts] of attemptsByWord.entries()) {
        const word = wordMap.get(id);
        if (!word) continue;

        const mistakeAttempts = attempts.filter((a) => !a.isCorrect);
        if (mistakeAttempts.length === 0) continue;

        const latestMistake = mistakeAttempts[0];
        const isResolved = isMistakeResolved(attempts);

        vocabMistakeItems.push({
          id,
          module: "VOCABULARY",
          title: word.word,
          subTitle: word.translation,
          latestWrongAnswer: latestMistake.userAnswer,
          correctAnswer: latestMistake.correctAnswer || word.translation,
          mistakesCount: mistakeAttempts.length,
          totalAttempts: attempts.length,
          lastMistakeAt: latestMistake.createdAt.toISOString(),
          isResolved,
          linkHref: `/vocabulary?search=${encodeURIComponent(word.word)}`,
        });
      }
    }
  }

  // 2. Synonym Mistakes
  const synMistakeItems: UnifiedMistakeItemDTO[] = [];
  if (moduleFilter === "ALL" || moduleFilter === "SYNONYMS") {
    const distinctSynIds = await SynonymAttempt.distinct("synonymGroupId", {
      userId: owner.userId,
      isCorrect: false,
    });

    if (distinctSynIds.length > 0) {
      const [groups, allAttempts] = await Promise.all([
        SynonymGroup.find({
          _id: { $in: distinctSynIds },
          userId: owner.userId,
        })
          .select("term synonyms meaning")
          .lean(),
        SynonymAttempt.find({
          userId: owner.userId,
          synonymGroupId: { $in: distinctSynIds },
        })
          .sort({ createdAt: -1 })
          .select("synonymGroupId isCorrect userAnswer correctAnswer createdAt")
          .lean(),
      ]);

      const groupMap = new Map(groups.map((g) => [g._id.toString(), g]));

      const attemptsByGroup = new Map<string, typeof allAttempts>();
      for (const a of allAttempts) {
        const id = a.synonymGroupId.toString();
        const list = attemptsByGroup.get(id) || [];
        list.push(a);
        attemptsByGroup.set(id, list);
      }

      for (const [id, attempts] of attemptsByGroup.entries()) {
        const group = groupMap.get(id);
        if (!group) continue;

        const mistakeAttempts = attempts.filter((a) => !a.isCorrect);
        if (mistakeAttempts.length === 0) continue;

        const latestMistake = mistakeAttempts[0];
        const isResolved = isMistakeResolved(attempts);
        const correctText =
          latestMistake.correctAnswer ||
          group.synonyms.map((s) => s.word).join(", ");

        synMistakeItems.push({
          id,
          module: "SYNONYMS",
          title: group.term,
          subTitle: group.meaning || undefined,
          latestWrongAnswer: latestMistake.userAnswer,
          correctAnswer: correctText,
          mistakesCount: mistakeAttempts.length,
          totalAttempts: attempts.length,
          lastMistakeAt: latestMistake.createdAt.toISOString(),
          isResolved,
          linkHref: `/synonyms?search=${encodeURIComponent(group.term)}`,
        });
      }
    }
  }

  // 3. Grammar Mistakes
  const grammarMistakeItems: UnifiedMistakeItemDTO[] = [];
  if (moduleFilter === "ALL" || moduleFilter === "GRAMMAR") {
    const distinctExerciseIds = await GrammarAttempt.distinct(
      "grammarExerciseId",
      {
        userId: owner.userId,
        isCorrect: false,
      },
    );

    if (distinctExerciseIds.length > 0) {
      const [exercises, allAttempts] = await Promise.all([
        GrammarExercise.find({
          _id: { $in: distinctExerciseIds },
          userId: owner.userId,
        })
          .select("question correctAnswer grammarTopicId type")
          .lean(),
        GrammarAttempt.find({
          userId: owner.userId,
          grammarExerciseId: { $in: distinctExerciseIds },
        })
          .sort({ createdAt: -1 })
          .select(
            "grammarExerciseId isCorrect userAnswer correctAnswer createdAt",
          )
          .lean(),
      ]);

      const exerciseMap = new Map(exercises.map((e) => [e._id.toString(), e]));

      const topicIds = Array.from(
        new Set(exercises.map((e) => e.grammarTopicId.toString())),
      );
      const topics = await GrammarTopic.find({
        _id: { $in: topicIds },
        userId: owner.userId,
      })
        .select("title")
        .lean();
      const topicMap = new Map(topics.map((t) => [t._id.toString(), t.title]));

      const attemptsByEx = new Map<string, typeof allAttempts>();
      for (const a of allAttempts) {
        const id = a.grammarExerciseId.toString();
        const list = attemptsByEx.get(id) || [];
        list.push(a);
        attemptsByEx.set(id, list);
      }

      for (const [id, attempts] of attemptsByEx.entries()) {
        const ex = exerciseMap.get(id);
        if (!ex) continue;

        const mistakeAttempts = attempts.filter((a) => !a.isCorrect);
        if (mistakeAttempts.length === 0) continue;

        const latestMistake = mistakeAttempts[0];
        const isResolved = isMistakeResolved(attempts);
        const topicTitle =
          topicMap.get(ex.grammarTopicId.toString()) || "Grammar Topic";

        grammarMistakeItems.push({
          id,
          module: "GRAMMAR",
          title: ex.question,
          subTitle: topicTitle,
          latestWrongAnswer: latestMistake.userAnswer,
          correctAnswer: ex.correctAnswer,
          mistakesCount: mistakeAttempts.length,
          totalAttempts: attempts.length,
          lastMistakeAt: latestMistake.createdAt.toISOString(),
          isResolved,
          linkHref: `/learn/grammar/${ex.grammarTopicId.toString()}`,
          topicId: ex.grammarTopicId.toString(),
          exerciseType: ex.type,
        });
      }
    }
  }

  // Combine items
  let allItems = [
    ...vocabMistakeItems,
    ...synMistakeItems,
    ...grammarMistakeItems,
  ];

  const totalMistakesCount = allItems.length;
  const unresolvedCount = allItems.filter((i) => !i.isResolved).length;
  const resolvedCount = allItems.filter((i) => i.isResolved).length;

  const moduleCounts = {
    VOCABULARY: vocabMistakeItems.length,
    SYNONYMS: synMistakeItems.length,
    GRAMMAR: grammarMistakeItems.length,
  };

  // Apply sorting and status filters
  if (sortFilter === "UNRESOLVED") {
    allItems = allItems
      .filter((i) => !i.isResolved)
      .sort(
        (a, b) =>
          new Date(b.lastMistakeAt).getTime() -
          new Date(a.lastMistakeAt).getTime(),
      );
  } else if (sortFilter === "MOST_REPEATED") {
    allItems.sort((a, b) => b.mistakesCount - a.mistakesCount);
  } else {
    // RECENT
    allItems.sort(
      (a, b) =>
        new Date(b.lastMistakeAt).getTime() -
        new Date(a.lastMistakeAt).getTime(),
    );
  }

  return {
    totalMistakesCount,
    unresolvedCount,
    resolvedCount,
    moduleCounts,
    items: allItems,
  };
}

/**
 * Creates a practice session targeting unresolved mistakes across modules.
 * Sets StudySession.type = "MISTAKES" and StudySession.module = "MIXED"
 */
export async function startMistakesPracticeSession(
  moduleFilter: MistakeTabFilter = "ALL",
  userIdOverride?: Types.ObjectId,
): Promise<string> {
  const owner = userIdOverride
    ? { userId: userIdOverride }
    : await ownedScope();
  await connectDB();

  const mistakesSummary = await getUnifiedMistakes(owner.userId, {
    module: moduleFilter,
    sort: "UNRESOLVED",
  });

  const unresolved = mistakesSummary.items.filter((i) => !i.isResolved);
  if (unresolved.length === 0) {
    throw new MistakesError("You have no unresolved mistakes to practice.");
  }

  // Take up to 20 mistakes
  const targetItems = unresolved.slice(0, 20);

  const vocabCandidates: DailyPlanItemCandidate[] = [];
  const synCandidates: DailyPlanItemCandidate[] = [];
  const grammarCandidates: DailyPlanItemCandidate[] = [];

  for (const item of targetItems) {
    if (item.module === "VOCABULARY") {
      vocabCandidates.push({
        module: "VOCABULARY",
        sourceId: item.id,
        exerciseType: "EN_TO_UZ",
        priorityScore: item.mistakesCount * 10,
        reason: "MISTAKE",
      });
    } else if (item.module === "SYNONYMS") {
      synCandidates.push({
        module: "SYNONYMS",
        sourceId: item.id,
        exerciseType: "RECOGNITION",
        priorityScore: item.mistakesCount * 10,
        reason: "MISTAKE",
      });
    } else {
      grammarCandidates.push({
        module: "GRAMMAR",
        sourceId: item.id,
        exerciseType: item.exerciseType || "MULTIPLE_CHOICE",
        priorityScore: item.mistakesCount * 10,
        reason: "MISTAKE",
      });
    }
  }

  const interleaved = interleaveCandidates(
    vocabCandidates,
    synCandidates,
    grammarCandidates,
  );

  const sessionItems: StudySessionItem[] = interleaved.map((cand, idx) => ({
    sessionItemId: crypto.randomUUID(),
    module: cand.module,
    vocabularyWordId:
      cand.module === "VOCABULARY"
        ? new Types.ObjectId(cand.sourceId)
        : undefined,
    synonymGroupId:
      cand.module === "SYNONYMS"
        ? new Types.ObjectId(cand.sourceId)
        : undefined,
    grammarExerciseId:
      cand.module === "GRAMMAR" ? new Types.ObjectId(cand.sourceId) : undefined,
    exerciseType: cand.exerciseType,
    order: idx,
    answered: false,
    isCorrect: null,
    retryCount: 0,
  }));

  const session = await StudySession.create({
    userId: owner.userId,
    module: "MIXED",
    type: "MISTAKES",
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
