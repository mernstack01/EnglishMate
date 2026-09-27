import test from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    path: serverOnlyPath,
    paths: [],
    children: [],
    isPreloading: false,
    require,
    parent: null,
  };
} catch {
  // Ignore
}

// 1. Pure Unit Tests: CEFR Level Derivation
test("CEFR evaluation correctly classifies learner level and targets", async () => {
  const { evaluateCefrLevel } = await import("../src/services/progress");

  // Zero / Beginner -> A1
  const a1 = evaluateCefrLevel(20, 40, 5);
  assert.equal(a1.level, "A1");
  assert.equal(a1.ieltsBand, "3.0 – 3.5");

  // Elementary -> A2
  const a2 = evaluateCefrLevel(200, 55, 20);
  assert.equal(a2.level, "A2");
  assert.equal(a2.ieltsBand, "4.0 – 4.5");

  // Intermediate -> B1
  const b1 = evaluateCefrLevel(500, 70, 50);
  assert.equal(b1.level, "B1");
  assert.equal(b1.ieltsBand, "5.0 – 5.5");

  // Upper Intermediate -> B2
  const b2 = evaluateCefrLevel(1000, 80, 120);
  assert.equal(b2.level, "B2");
  assert.equal(b2.ieltsBand, "6.0 – 6.5");

  // Advanced -> C1
  const c1 = evaluateCefrLevel(1800, 88, 220);
  assert.equal(c1.level, "C1");
  assert.equal(c1.ieltsBand, "7.0 – 8.0+");
});

// 2. Pure Unit Tests: Longest Consecutive Streak
test("calculateLongestStreak accurately measures continuous day streaks across gaps", async () => {
  const { calculateLongestStreak } = await import("../src/services/progress");

  assert.equal(calculateLongestStreak([]), 0);
  assert.equal(calculateLongestStreak(["2026-09-01"]), 1);

  // Consecutive sequence of 4 days
  assert.equal(
    calculateLongestStreak([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
    ]),
    4,
  );

  // Sequences with gap: 2 days, gap, 5 days
  assert.equal(
    calculateLongestStreak([
      "2026-09-01",
      "2026-09-02",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
      "2026-09-14",
    ]),
    5,
  );
});

// 3. Database Integration: Fresh User Scenario & Strict User Isolation
test("database integration: empty state safety and multi-user isolation", async () => {
  const mongo = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongo.getUri("test_progress_isolation"));
    const { VocabularyWord } = await import("../src/models/vocabulary-word");
    const { VocabularyReview } =
      await import("../src/models/vocabulary-review");
    const { VocabularyAttempt } =
      await import("../src/models/vocabulary-attempt");
    const { SynonymGroup } = await import("../src/models/synonym-group");
    const { GrammarTopic } = await import("../src/models/grammar-topic");
    const { GrammarAttempt } = await import("../src/models/grammar-attempt");
    const { StudySession } = await import("../src/models/study-session");
    const { getProgressAnalytics } = await import("../src/services/progress");

    await Promise.all([
      VocabularyWord.createIndexes(),
      VocabularyReview.createIndexes(),
      VocabularyAttempt.createIndexes(),
      SynonymGroup.createIndexes(),
      GrammarTopic.createIndexes(),
      GrammarAttempt.createIndexes(),
      StudySession.createIndexes(),
    ]);

    const userA = new Types.ObjectId();
    const userB = new Types.ObjectId();

    // 1. User B has ZERO activity
    const analyticsB = await getProgressAnalytics(userB);
    assert.equal(analyticsB.mastery.overallScore, 0);
    assert.equal(analyticsB.mastery.cefr.level, "A1");
    assert.equal(analyticsB.mastery.currentStreak, 0);
    assert.equal(analyticsB.mastery.longestStreak, 0);
    assert.equal(analyticsB.mastery.totalSessionsCompleted, 0);
    assert.equal(analyticsB.vocabulary.totalWords, 0);
    assert.equal(analyticsB.synonyms.totalGroups, 0);
    assert.equal(analyticsB.grammar.totalTopics, 0);
    assert.equal(analyticsB.activity30Days.length, 30);
    assert.ok(analyticsB.recommendations.length > 0);

    // 2. Populate User A data across all 3 pillars
    // Vocabulary for User A
    const wordA = await VocabularyWord.create({
      userId: userA,
      word: "persevere",
      normalizedWord: "persevere",
      translation: "qat'iyat ko'rsatmoq",
      status: "LEARNED",
      source: "MANUAL",
    });
    await VocabularyReview.create({
      userId: userA,
      vocabularyWordId: wordA._id,
      intervalDays: 20,
      nextReviewAt: new Date(Date.now() + 86400000),
    });
    await VocabularyAttempt.create({
      userId: userA,
      vocabularyWordId: wordA._id,
      studySessionId: new Types.ObjectId(),
      exerciseType: "MULTIPLE_CHOICE",
      prompt: "persevere",
      userAnswer: "qat'iyat ko'rsatmoq",
      correctAnswer: "qat'iyat ko'rsatmoq",
      isCorrect: true,
      rating: "GOOD",
    });

    // Synonyms for User A
    await SynonymGroup.create({
      userId: userA,
      term: "Resilient",
      normalizedTerm: "resilient",
      meaning: "Able to withstand difficulties",
      notes: "",
      status: "LEARNED",
      source: "MANUAL",
      synonyms: [
        { word: "tough", normalizedWord: "tough", example: "" },
        { word: "durable", normalizedWord: "durable", example: "" },
      ],
    });

    // Grammar for User A
    const topicA = await GrammarTopic.create({
      userId: userA,
      title: "Past Perfect",
      normalizedTitle: "past perfect",
      category: "TENSES",
      description: "Had + past participle",
      content: "Rules for past perfect.",
      status: "LEARNED",
      attemptsCount: 10,
      correctCount: 9,
      accuracy: 90,
    });
    await GrammarAttempt.create({
      userId: userA,
      grammarTopicId: topicA._id,
      grammarExerciseId: new Types.ObjectId(),
      studySessionId: new Types.ObjectId(),
      exerciseType: "MULTIPLE_CHOICE",
      prompt: "She had left.",
      userAnswer: "had left",
      normalizedAnswer: "had left",
      correctAnswer: "had left",
      isCorrect: true,
    });

    // StudySession for User A
    await StudySession.create({
      userId: userA,
      module: "VOCABULARY",
      type: "DAILY",
      totalQuestions: 1,
      answeredQuestions: 1,
      correctAnswers: 1,
      incorrectAnswers: 0,
      completedAt: new Date(),
      items: [],
    });

    // 3. User B still has ZERO records (strict isolation)
    const analyticsBAfterA = await getProgressAnalytics(userB);
    assert.equal(analyticsBAfterA.vocabulary.totalWords, 0);
    assert.equal(analyticsBAfterA.synonyms.totalGroups, 0);
    assert.equal(analyticsBAfterA.grammar.totalTopics, 0);
    assert.equal(analyticsBAfterA.mastery.totalSessionsCompleted, 0);

    // 4. User A's analytics accurately reflects all 3 pillars
    const analyticsA = await getProgressAnalytics(userA);
    assert.equal(analyticsA.vocabulary.totalWords, 1);
    assert.equal(analyticsA.vocabulary.statusCounts.learned, 1);
    assert.equal(analyticsA.vocabulary.intervalStages.matureCount, 1);
    assert.equal(analyticsA.vocabulary.retentionRate, 100);

    assert.equal(analyticsA.synonyms.totalGroups, 1);
    assert.equal(analyticsA.synonyms.totalSynonyms, 2);
    assert.equal(analyticsA.synonyms.statusCounts.learned, 1);

    assert.equal(analyticsA.grammar.totalTopics, 1);
    assert.equal(analyticsA.grammar.topicsLearned, 1);
    assert.equal(analyticsA.grammar.overallAccuracy, 100);

    assert.equal(analyticsA.mastery.totalSessionsCompleted, 1);
    assert.equal(analyticsA.mastery.currentStreak, 1);
    assert.equal(analyticsA.mastery.longestStreak, 1);
    assert.ok(analyticsA.mastery.overallScore > 0);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});
