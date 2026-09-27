import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { ownedScope } from "@/lib/db/ownership";
import { vocabularyTimezone } from "@/lib/vocabulary-timezone";
import { dateKey } from "@/lib/dates";
import { calculateStreakFromDates } from "@/lib/streak";
import { VocabularyWord } from "@/models/vocabulary-word";
import { VocabularyReview } from "@/models/vocabulary-review";
import { VocabularyAttempt } from "@/models/vocabulary-attempt";
import { SynonymGroup } from "@/models/synonym-group";
import { SynonymReview } from "@/models/synonym-review";
import { SynonymAttempt } from "@/models/synonym-attempt";
import { GrammarTopic, type GrammarTopicRecord } from "@/models/grammar-topic";
import { GrammarAttempt } from "@/models/grammar-attempt";
import { StudySession, type StudySessionRecord } from "@/models/study-session";
import {
  grammarCategories,
  grammarCategoryLabels,
  grammarExerciseTypes,
  grammarExerciseTypeLabels,
  type GrammarCategory,
} from "@/features/grammar/constants";
import type {
  ProgressAnalyticsDTO,
  CefrEvaluation,
  DailyActivityItemDTO,
  GrammarCategoryAnalytics,
  GrammarExerciseTypeAnalytics,
  GrammarTopicChallengeDTO,
  SmartRecommendationDTO,
} from "@/types/progress";

/**
 * Derives CEFR level and estimated IELTS band from vocabulary size, grammar accuracy, and synonym depth.
 */
export function evaluateCefrLevel(
  vocabularyCount: number,
  grammarAccuracy: number,
  synonymCount: number,
): CefrEvaluation {
  if (vocabularyCount >= 1500 && grammarAccuracy >= 85 && synonymCount >= 200) {
    return {
      level: "C1",
      title: "Advanced Learner",
      ieltsBand: "7.0 – 8.0+",
      description:
        "Fluent and versatile communication with nuanced synonyms and high grammatical precision.",
      criteriaProgress: {
        vocabularyCount,
        targetVocabulary: 2000,
        grammarAccuracy,
        targetAccuracy: 90,
        synonymDepth: synonymCount,
        targetSynonyms: 250,
      },
    };
  }

  if (vocabularyCount >= 800 && grammarAccuracy >= 75 && synonymCount >= 100) {
    return {
      level: "B2",
      title: "Upper Intermediate",
      ieltsBand: "6.0 – 6.5",
      description:
        "Strong grasp of complex grammar, varied vocabulary, and effective conversational recall.",
      criteriaProgress: {
        vocabularyCount,
        targetVocabulary: 1500,
        grammarAccuracy,
        targetAccuracy: 85,
        synonymDepth: synonymCount,
        targetSynonyms: 200,
      },
    };
  }

  if (vocabularyCount >= 400 && grammarAccuracy >= 65 && synonymCount >= 40) {
    return {
      level: "B1",
      title: "Intermediate",
      ieltsBand: "5.0 – 5.5",
      description:
        "Comfortable with everyday communication, core tenses, and foundational expressions.",
      criteriaProgress: {
        vocabularyCount,
        targetVocabulary: 800,
        grammarAccuracy,
        targetAccuracy: 75,
        synonymDepth: synonymCount,
        targetSynonyms: 100,
      },
    };
  }

  if (vocabularyCount >= 150 && grammarAccuracy >= 50) {
    return {
      level: "A2",
      title: "Elementary",
      ieltsBand: "4.0 – 4.5",
      description:
        "Growing familiarity with routine situations, essential verbs, and daily vocabulary.",
      criteriaProgress: {
        vocabularyCount,
        targetVocabulary: 400,
        grammarAccuracy,
        targetAccuracy: 65,
        synonymDepth: synonymCount,
        targetSynonyms: 40,
      },
    };
  }

  return {
    level: "A1",
    title: "Beginner",
    ieltsBand: "3.0 – 3.5",
    description:
      "Starting your English journey with fundamental words, basic structures, and everyday expressions.",
    criteriaProgress: {
      vocabularyCount,
      targetVocabulary: 150,
      grammarAccuracy,
      targetAccuracy: 50,
      synonymDepth: synonymCount,
      targetSynonyms: 20,
    },
  };
}

/**
 * Calculates the longest consecutive streak of active days.
 */
export function calculateLongestStreak(dateKeys: string[]): number {
  if (dateKeys.length === 0) return 0;

  const sorted = Array.from(new Set(dateKeys)).sort();
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(`${sorted[i - 1]}T00:00:00Z`);
    const currDate = new Date(`${sorted[i]}T00:00:00Z`);
    const diffDays = Math.round(
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 1) {
      currentStreak += 1;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    } else if (diffDays > 1) {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

/**
 * Assembles the full analytics and mastery state for the authenticated user.
 */
export async function getProgressAnalytics(
  userIdOverride?: Types.ObjectId,
): Promise<ProgressAnalyticsDTO> {
  const owner = userIdOverride
    ? { userId: userIdOverride }
    : await ownedScope();
  await connectDB();

  const timezone = vocabularyTimezone();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Parallel Database Queries across all 3 modules and sessions
  const [
    vocabWords,
    vocabReviews,
    vocabAttemptsTotal,
    vocabAttemptsCorrect,
    synonymGroups,
    synonymReviewsDue,
    synonymAttemptsTotal,
    synonymAttemptsCorrect,
    grammarTopics,
    grammarAttemptsTotal,
    grammarAttemptsCorrect,
    grammarAttemptsByType,
    sessions,
  ] = await Promise.all([
    // Vocabulary word counts & statuses
    VocabularyWord.find({ userId: owner.userId })
      .select("status createdAt")
      .lean(),
    // Vocabulary reviews for intervals & due
    VocabularyReview.find({ userId: owner.userId })
      .select("nextReviewAt intervalDays")
      .lean(),
    // Vocabulary attempts
    VocabularyAttempt.countDocuments({ userId: owner.userId }),
    VocabularyAttempt.countDocuments({
      userId: owner.userId,
      isCorrect: true,
    }),
    // Synonym groups
    SynonymGroup.find({ userId: owner.userId })
      .select("status synonyms")
      .lean(),
    // Synonym reviews due
    SynonymReview.countDocuments({
      userId: owner.userId,
      nextReviewAt: { $lte: now },
    }),
    // Synonym attempts
    SynonymAttempt.countDocuments({ userId: owner.userId }),
    SynonymAttempt.countDocuments({
      userId: owner.userId,
      isCorrect: true,
    }),
    // Grammar topics
    GrammarTopic.find({ userId: owner.userId })
      .select("title category status attemptsCount correctCount accuracy")
      .lean<Array<GrammarTopicRecord & { _id: Types.ObjectId }>>(),
    // Grammar attempts
    GrammarAttempt.countDocuments({ userId: owner.userId }),
    GrammarAttempt.countDocuments({
      userId: owner.userId,
      isCorrect: true,
    }),
    // Grammar attempts grouped by exercise type
    GrammarAttempt.aggregate<{
      _id: string;
      total: number;
      correct: number;
    }>([
      { $match: { userId: owner.userId } },
      {
        $group: {
          _id: "$exerciseType",
          total: { $sum: 1 },
          correct: {
            $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] },
          },
        },
      },
    ]),
    // Study sessions completed
    StudySession.find({
      userId: owner.userId,
      completedAt: { $ne: null },
    })
      .select(
        "module completedAt totalQuestions answeredQuestions correctAnswers",
      )
      .sort({ completedAt: 1 })
      .lean<StudySessionRecord[]>(),
  ]);

  // 1. Vocabulary Analytics Breakdown
  const totalWords = vocabWords.length;
  const vocabStatusCounts = {
    new: 0,
    learning: 0,
    difficult: 0,
    learned: 0,
  };
  let vocabAddedThisWeek = 0;

  for (const w of vocabWords) {
    if (w.status === "NEW") vocabStatusCounts.new += 1;
    else if (w.status === "LEARNING") vocabStatusCounts.learning += 1;
    else if (w.status === "DIFFICULT") vocabStatusCounts.difficult += 1;
    else if (w.status === "LEARNED") vocabStatusCounts.learned += 1;

    if (w.createdAt && w.createdAt >= sevenDaysAgo) {
      vocabAddedThisWeek += 1;
    }
  }

  let vocabLearningStages = 0;
  let vocabMaturingStages = 0;
  let vocabMatureStages = 0;
  let vocabDueCount = 0;

  for (const r of vocabReviews) {
    if (r.nextReviewAt && r.nextReviewAt <= now) {
      vocabDueCount += 1;
    }
    const interval = r.intervalDays || 0;
    if (interval < 4) {
      vocabLearningStages += 1;
    } else if (interval < 15) {
      vocabMaturingStages += 1;
    } else {
      vocabMatureStages += 1;
    }
  }

  const vocabRetentionRate =
    vocabAttemptsTotal > 0
      ? Math.round((vocabAttemptsCorrect / vocabAttemptsTotal) * 100)
      : 0;

  // 2. Synonym Analytics Breakdown
  const totalSynonymGroups = synonymGroups.length;
  let totalSynonymsCount = 0;
  const synonymStatusCounts = {
    new: 0,
    learning: 0,
    difficult: 0,
    learned: 0,
  };

  for (const g of synonymGroups) {
    totalSynonymsCount += g.synonyms ? g.synonyms.length : 0;
    if (g.status === "NEW") synonymStatusCounts.new += 1;
    else if (g.status === "LEARNING") synonymStatusCounts.learning += 1;
    else if (g.status === "DIFFICULT") synonymStatusCounts.difficult += 1;
    else if (g.status === "LEARNED") synonymStatusCounts.learned += 1;
  }

  const avgSynonymsPerGroup =
    totalSynonymGroups > 0
      ? Math.round((totalSynonymsCount / totalSynonymGroups) * 10) / 10
      : 0;

  const synonymRecallAccuracy =
    synonymAttemptsTotal > 0
      ? Math.round((synonymAttemptsCorrect / synonymAttemptsTotal) * 100)
      : 0;

  // 3. Grammar Analytics Breakdown
  const totalGrammarTopics = grammarTopics.length;
  let grammarLearnedCount = 0;
  let grammarPracticedCount = 0;

  const categoryMap = new Map<
    GrammarCategory,
    { topicCount: number; attempts: number; correct: number }
  >();

  for (const cat of grammarCategories) {
    categoryMap.set(cat, { topicCount: 0, attempts: 0, correct: 0 });
  }

  const challengingTopicsList: GrammarTopicChallengeDTO[] = [];

  for (const t of grammarTopics) {
    if (t.status === "LEARNED") grammarLearnedCount += 1;
    if (t.attemptsCount > 0) grammarPracticedCount += 1;

    const catStats = categoryMap.get(t.category);
    if (catStats) {
      catStats.topicCount += 1;
      catStats.attempts += t.attemptsCount || 0;
      catStats.correct += t.correctCount || 0;
    }

    if (t.status === "DIFFICULT" || (t.attemptsCount > 0 && t.accuracy < 75)) {
      challengingTopicsList.push({
        id: t._id.toString(),
        title: t.title,
        category: t.category,
        status: t.status,
        attemptsCount: t.attemptsCount,
        accuracy: t.accuracy,
        mistakesCount: Math.max(0, t.attemptsCount - t.correctCount),
      });
    }
  }

  challengingTopicsList.sort((a, b) => a.accuracy - b.accuracy);

  const grammarCategoryBreakdown: GrammarCategoryAnalytics[] =
    grammarCategories.map((cat) => {
      const data = categoryMap.get(cat) || {
        topicCount: 0,
        attempts: 0,
        correct: 0,
      };
      const accuracy =
        data.attempts > 0
          ? Math.round((data.correct / data.attempts) * 100)
          : 0;
      return {
        category: cat,
        label: grammarCategoryLabels[cat],
        topicCount: data.topicCount,
        attemptsCount: data.attempts,
        correctCount: data.correct,
        accuracy,
      };
    });

  const typeMap = new Map(
    grammarAttemptsByType.map((item) => [
      item._id,
      { total: item.total, correct: item.correct },
    ]),
  );

  const grammarExerciseTypeBreakdown: GrammarExerciseTypeAnalytics[] =
    grammarExerciseTypes.map((et) => {
      const stats = typeMap.get(et) || { total: 0, correct: 0 };
      const accuracy =
        stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
      return {
        exerciseType: et,
        label: grammarExerciseTypeLabels[et],
        attemptsCount: stats.total,
        correctCount: stats.correct,
        accuracy,
      };
    });

  const grammarOverallAccuracy =
    grammarAttemptsTotal > 0
      ? Math.round((grammarAttemptsCorrect / grammarAttemptsTotal) * 100)
      : 0;

  const grammarCoveragePercent =
    totalGrammarTopics > 0
      ? Math.round((grammarPracticedCount / totalGrammarTopics) * 100)
      : 0;

  // 4. Session & Streak Calculations
  const dateKeysList: string[] = [];
  const moduleSessions = { vocabulary: 0, synonyms: 0, grammar: 0 };
  let totalQuestionsAnsweredAll = 0;
  let totalCorrectAnswersAll = 0;

  for (const s of sessions) {
    if (s.completedAt) {
      dateKeysList.push(dateKey(s.completedAt, timezone));
    }
    if (s.module === "VOCABULARY") moduleSessions.vocabulary += 1;
    else if (s.module === "SYNONYMS") moduleSessions.synonyms += 1;
    else if (s.module === "GRAMMAR") moduleSessions.grammar += 1;

    totalQuestionsAnsweredAll += s.answeredQuestions || s.totalQuestions || 0;
    totalCorrectAnswersAll += s.correctAnswers || 0;
  }

  const distinctDateKeys = Array.from(new Set(dateKeysList));
  const todayKey = dateKey(now, timezone);
  const currentStreak = calculateStreakFromDates(
    new Set(distinctDateKeys),
    todayKey,
  );
  const longestStreak = calculateLongestStreak(distinctDateKeys);
  const activeDaysCount = distinctDateKeys.length;

  const overallAccuracy =
    totalQuestionsAnsweredAll > 0
      ? Math.round((totalCorrectAnswersAll / totalQuestionsAnsweredAll) * 100)
      : 0;

  // 5. 30-Day Activity Grid Construction
  const activityMap = new Map<
    string,
    { sessions: number; questions: number }
  >();
  for (const s of sessions) {
    if (!s.completedAt) continue;
    const dk = dateKey(s.completedAt, timezone);
    const existing = activityMap.get(dk) || { sessions: 0, questions: 0 };
    existing.sessions += 1;
    existing.questions += s.answeredQuestions || s.totalQuestions || 0;
    activityMap.set(dk, existing);
  }

  const activity30Days: DailyActivityItemDTO[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dk = dateKey(d, timezone);
    const activity = activityMap.get(dk) || { sessions: 0, questions: 0 };

    let intensity: 0 | 1 | 2 | 3 | 4 = 0;
    if (activity.sessions >= 4 || activity.questions >= 30) intensity = 4;
    else if (activity.sessions >= 3 || activity.questions >= 20) intensity = 3;
    else if (activity.sessions >= 2 || activity.questions >= 10) intensity = 2;
    else if (activity.sessions >= 1 || activity.questions > 0) intensity = 1;

    activity30Days.push({
      date: dk,
      dayOfWeek: d.getUTCDay(),
      dayOfMonth: d.getUTCDate(),
      displayDay: dayNames[d.getUTCDay()],
      completedSessions: activity.sessions,
      questionsAnswered: activity.questions,
      intensity,
    });
  }

  // 6. Global Mastery Score & CEFR Level
  const vocabScore =
    totalWords > 0
      ? Math.min(
          100,
          Math.round(
            ((vocabStatusCounts.learned * 1.0 +
              vocabStatusCounts.learning * 0.6) /
              totalWords) *
              100,
          ),
        )
      : 0;

  const synonymScore =
    totalSynonymGroups > 0
      ? Math.min(
          100,
          Math.round(
            ((synonymStatusCounts.learned * 1.0 +
              synonymStatusCounts.learning * 0.6) /
              totalSynonymGroups) *
              100,
          ),
        )
      : 0;

  const grammarScore =
    totalGrammarTopics > 0
      ? Math.min(
          100,
          Math.round(
            (grammarPracticedCount / totalGrammarTopics) * 40 +
              grammarOverallAccuracy * 0.6,
          ),
        )
      : 0;

  // Weighted overall composite: 40% Vocabulary, 30% Synonyms, 30% Grammar
  let overallScore = 0;
  const activeModulesCount =
    (totalWords > 0 ? 1 : 0) +
    (totalSynonymGroups > 0 ? 1 : 0) +
    (totalGrammarTopics > 0 ? 1 : 0);

  if (activeModulesCount > 0) {
    overallScore = Math.round(
      vocabScore * 0.4 + synonymScore * 0.3 + grammarScore * 0.3,
    );
  }

  const cefr = evaluateCefrLevel(
    totalWords,
    grammarOverallAccuracy,
    totalSynonymsCount,
  );

  // 7. Dynamic Smart Recommendations
  const recommendations: SmartRecommendationDTO[] = [];

  if (vocabDueCount > 0) {
    recommendations.push({
      id: "rec_vocab_due",
      type: "ACTION",
      title: `${vocabDueCount} Vocabulary Word${vocabDueCount > 1 ? "s" : ""} Due`,
      description:
        "Spaced repetition memory decay is setting in. Review today to keep intervals growing.",
      metric: `${vocabDueCount} due`,
      actionHref: "/learn",
      actionLabel: "Review Vocabulary",
    });
  } else if (vocabStatusCounts.difficult > 0) {
    recommendations.push({
      id: "rec_vocab_difficult",
      type: "FOCUS",
      title: `${vocabStatusCounts.difficult} Difficult Words Need Practice`,
      description:
        "Targeted drills help convert troublesome vocabulary into reliable long-term memory.",
      metric: `${vocabStatusCounts.difficult} words`,
      actionHref: "/learn/vocabulary/difficult",
      actionLabel: "Practice Difficult Words",
    });
  }

  if (challengingTopicsList.length > 0) {
    const hardest = challengingTopicsList[0];
    recommendations.push({
      id: "rec_grammar_weak",
      type: "FOCUS",
      title: `Grammar Focus: ${hardest.title}`,
      description: `Current accuracy is ${hardest.accuracy}%. A 5-minute practice session will solidify rules.`,
      metric: `${hardest.accuracy}% accuracy`,
      actionHref: `/learn/grammar/${hardest.id}`,
      actionLabel: "Practice Topic",
    });
  }

  // Find strongest grammar category with >= 5 attempts
  const topCategory = [...grammarCategoryBreakdown]
    .filter((c) => c.attemptsCount >= 5)
    .sort((a, b) => b.accuracy - a.accuracy)[0];

  if (topCategory && topCategory.accuracy >= 75) {
    recommendations.push({
      id: "rec_strength",
      type: "STRENGTH",
      title: `Strong Mastery in ${topCategory.label}`,
      description: `You are answering with ${topCategory.accuracy}% accuracy across ${topCategory.attemptsCount} exercises. Keep up the high standard!`,
      metric: `${topCategory.accuracy}% accuracy`,
    });
  } else if (currentStreak >= 3) {
    recommendations.push({
      id: "rec_streak_praise",
      type: "STRENGTH",
      title: `${currentStreak} Day Study Streak`,
      description:
        "Consistency is the #1 predictor of language mastery. You're building a lasting daily habit.",
      metric: `${currentStreak} days`,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "rec_start",
      type: "ACTION",
      title: "Start Your Daily Learning Routine",
      description:
        "Jump into interactive exercises to build your mastery score and establish your streak.",
      actionHref: "/learn",
      actionLabel: "Start Practice",
    });
  }

  return {
    mastery: {
      overallScore,
      cefr,
      currentStreak,
      longestStreak,
      activeDaysCount,
      totalSessionsCompleted: sessions.length,
      totalQuestionsAnswered: totalQuestionsAnsweredAll,
      overallAccuracy,
      moduleSessionCounts: moduleSessions,
    },
    vocabulary: {
      totalWords,
      statusCounts: vocabStatusCounts,
      retentionRate: vocabRetentionRate,
      totalAttempts: vocabAttemptsTotal,
      correctAttempts: vocabAttemptsCorrect,
      intervalStages: {
        learningCount: vocabLearningStages,
        maturingCount: vocabMaturingStages,
        matureCount: vocabMatureStages,
      },
      dueCount: vocabDueCount,
      addedThisWeekCount: vocabAddedThisWeek,
    },
    synonyms: {
      totalGroups: totalSynonymGroups,
      totalSynonyms: totalSynonymsCount,
      avgSynonymsPerGroup,
      statusCounts: synonymStatusCounts,
      recallAccuracy: synonymRecallAccuracy,
      totalAttempts: synonymAttemptsTotal,
      correctAttempts: synonymAttemptsCorrect,
      dueCount: synonymReviewsDue,
    },
    grammar: {
      totalTopics: totalGrammarTopics,
      topicsLearned: grammarLearnedCount,
      topicsPracticed: grammarPracticedCount,
      coveragePercent: grammarCoveragePercent,
      totalAttempts: grammarAttemptsTotal,
      correctAttempts: grammarAttemptsCorrect,
      overallAccuracy: grammarOverallAccuracy,
      categoryBreakdown: grammarCategoryBreakdown,
      exerciseTypeBreakdown: grammarExerciseTypeBreakdown,
      challengingTopics: challengingTopicsList.slice(0, 5),
    },
    activity30Days,
    recommendations,
  };
}
