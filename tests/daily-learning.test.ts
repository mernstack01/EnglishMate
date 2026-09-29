import test from "node:test";
import assert from "node:assert/strict";
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

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { User } from "@/models/user";
import { VocabularyWord } from "@/models/vocabulary-word";
import { VocabularyReview } from "@/models/vocabulary-review";
import { SynonymGroup } from "@/models/synonym-group";
import { SynonymReview } from "@/models/synonym-review";
import { GrammarTopic } from "@/models/grammar-topic";
import { GrammarExercise } from "@/models/grammar-exercise";
import type {
  DailyPlanItemCandidate,
  DailyQuestionDTO,
} from "@/types/daily-learning";
let redistributeQuotas: (typeof import("../src/services/daily-learning"))["redistributeQuotas"];
let interleaveCandidates: (typeof import("../src/services/daily-learning"))["interleaveCandidates"];
let buildDailyLearningPlan: (typeof import("../src/services/daily-learning"))["buildDailyLearningPlan"];
let startDailySession: (typeof import("../src/services/daily-learning"))["startDailySession"];
let getDailySessionState: (typeof import("../src/services/daily-learning"))["getDailySessionState"];
let submitDailyAnswer: (typeof import("../src/services/daily-learning"))["submitDailyAnswer"];
let getDailySessionSummary: (typeof import("../src/services/daily-learning"))["getDailySessionSummary"];

let mongod: MongoMemoryServer;

test.before(async () => {
  const mod = await import("../src/services/daily-learning");
  redistributeQuotas = mod.redistributeQuotas;
  interleaveCandidates = mod.interleaveCandidates;
  buildDailyLearningPlan = mod.buildDailyLearningPlan;
  startDailySession = mod.startDailySession;
  getDailySessionState = mod.getDailySessionState;
  submitDailyAnswer = mod.submitDailyAnswer;
  getDailySessionSummary = mod.getDailySessionSummary;

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test.beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

test("redistributeQuotas: proportional distribution and adaptive reallocation", () => {
  // Balanced available
  const q20 = redistributeQuotas(20, {
    VOCABULARY: 20,
    SYNONYMS: 10,
    GRAMMAR: 10,
  });
  assert.equal(q20.VOCABULARY, 10);
  assert.equal(q20.SYNONYMS, 5);
  assert.equal(q20.GRAMMAR, 5);
  assert.equal(q20.VOCABULARY + q20.SYNONYMS + q20.GRAMMAR, 20);

  // Goal 10
  const q10 = redistributeQuotas(10, {
    VOCABULARY: 20,
    SYNONYMS: 10,
    GRAMMAR: 10,
  });
  assert.equal(q10.VOCABULARY + q10.SYNONYMS + q10.GRAMMAR, 10);

  // Goal 30
  const q30 = redistributeQuotas(30, {
    VOCABULARY: 30,
    SYNONYMS: 20,
    GRAMMAR: 20,
  });
  assert.equal(q30.VOCABULARY + q30.SYNONYMS + q30.GRAMMAR, 30);

  // Zero Synonyms available: redistributed between Vocab and Grammar
  const qNoSyn = redistributeQuotas(20, {
    VOCABULARY: 20,
    SYNONYMS: 0,
    GRAMMAR: 10,
  });
  assert.equal(qNoSyn.SYNONYMS, 0);
  assert.equal(qNoSyn.VOCABULARY + qNoSyn.GRAMMAR, 20);
  assert.ok(qNoSyn.VOCABULARY > 10);
  assert.ok(qNoSyn.GRAMMAR > 5);

  // Only Vocabulary available: 100% Vocabulary
  const qVocabOnly = redistributeQuotas(20, {
    VOCABULARY: 15,
    SYNONYMS: 0,
    GRAMMAR: 0,
  });
  assert.equal(qVocabOnly.VOCABULARY, 15);
  assert.equal(qVocabOnly.SYNONYMS, 0);
  assert.equal(qVocabOnly.GRAMMAR, 0);

  // Zero items available: all zero
  const qEmpty = redistributeQuotas(20, {
    VOCABULARY: 0,
    SYNONYMS: 0,
    GRAMMAR: 0,
  });
  assert.equal(qEmpty.VOCABULARY, 0);
  assert.equal(qEmpty.SYNONYMS, 0);
  assert.equal(qEmpty.GRAMMAR, 0);
});

test("interleaveCandidates: smooth alternation across available modules", () => {
  const makeCandidate = (
    module: "VOCABULARY" | "SYNONYMS" | "GRAMMAR",
    id: string,
  ): DailyPlanItemCandidate => ({
    module,
    sourceId: id,
    exerciseType: "MC",
    priorityScore: 100,
    reason: "DUE",
  });

  const vocab = [
    makeCandidate("VOCABULARY", "v1"),
    makeCandidate("VOCABULARY", "v2"),
    makeCandidate("VOCABULARY", "v3"),
    makeCandidate("VOCABULARY", "v4"),
  ];
  const syn = [
    makeCandidate("SYNONYMS", "s1"),
    makeCandidate("SYNONYMS", "s2"),
  ];
  const grammar = [
    makeCandidate("GRAMMAR", "g1"),
    makeCandidate("GRAMMAR", "g2"),
  ];

  const interleaved = interleaveCandidates(vocab, syn, grammar);
  assert.equal(interleaved.length, 8);

  // Check modules are interleaved without 4 consecutive vocab at the beginning
  const moduleSequence = interleaved.map((i) => i.module);
  assert.equal(moduleSequence[0], "VOCABULARY");
  assert.equal(moduleSequence[1], "VOCABULARY");
  assert.equal(moduleSequence[2], "SYNONYMS");
  assert.equal(moduleSequence[3], "GRAMMAR");
});

test("database integration: buildDailyLearningPlan with due, mistakes, difficult, and new items", async () => {
  const user = await User.create({
    name: "Commuter Learner",
    email: "commuter@example.com",
    passwordHash: "hash1234",
    role: "USER",
    dailyQuestionGoal: 20,
  });

  // Empty state check
  const emptyPlan = await buildDailyLearningPlan(user._id);
  assert.equal(emptyPlan.totalCount, 0);
  assert.equal(emptyPlan.availableModules.length, 0);

  // Add 12 Vocabulary words (some due, some difficult, some new)
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

  for (let i = 1; i <= 12; i++) {
    const status = i <= 3 ? "DIFFICULT" : i <= 6 ? "LEARNING" : "NEW";
    const w = await VocabularyWord.create({
      userId: user._id,
      word: `word_${i}`,
      translation: `tarjima_${i}`,
      status,
      review: {
        nextReviewAt: i <= 5 ? past : future,
        intervalDays: 1,
        easeFactor: 2.5,
        repetitions: 1,
        correctCount: 1,
        incorrectCount: 0,
      },
    });

    await VocabularyReview.create({
      userId: user._id,
      vocabularyWordId: w._id,
      nextReviewAt: i <= 5 ? past : future,
      intervalDays: 1,
      easeFactor: 2.5,
      repetitions: 1,
      correctCount: 1,
      incorrectCount: 0,
    });
  }

  // Add 5 Synonym groups
  for (let i = 1; i <= 5; i++) {
    const g = await SynonymGroup.create({
      userId: user._id,
      term: `syn_term_${i}`,
      synonyms: [{ word: `syn_word_${i}`, meaning: "Meaning" }],
      status: i <= 2 ? "NEW" : "LEARNING",
      review: {
        nextReviewAt: i === 3 ? past : future,
        intervalDays: 1,
        easeFactor: 2.5,
        repetitions: 1,
        correctCount: 1,
        incorrectCount: 0,
      },
    });

    await SynonymReview.create({
      userId: user._id,
      synonymGroupId: g._id,
      nextReviewAt: i === 3 ? past : future,
      intervalDays: 1,
      easeFactor: 2.5,
      repetitions: 1,
      correctCount: 1,
      incorrectCount: 0,
    });
  }

  // Add 1 Grammar topic with 5 exercises
  const topic = await GrammarTopic.create({
    userId: user._id,
    title: "Modal Verbs",
    normalizedTitle: "modal verbs",
    category: "MODAL_VERBS",
    description: "Modal verbs topic",
    content: "Content about modal verbs",
    status: "NEW",
  });

  for (let i = 1; i <= 5; i++) {
    await GrammarExercise.create({
      userId: user._id,
      grammarTopicId: topic._id,
      type: "MULTIPLE_CHOICE",
      question: `Question ${i}?`,
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
      explanation: "Because A",
      order: i,
      attemptCount: 0,
      correctCount: 0,
      incorrectCount: 0,
    });
  }

  // Test plan building with all modules
  const plan = await buildDailyLearningPlan(user._id);
  assert.equal(plan.totalCount, 20);
  assert.ok(plan.vocabularyCount >= 8);
  assert.ok(plan.synonymsCount >= 4);
  assert.ok(plan.grammarCount >= 4);
  assert.equal(plan.availableModules.length, 3);
  assert.ok(plan.estimatedMinutes >= 10);
  assert.ok(plan.dueCount >= 6); // 5 vocab due + 1 syn due
});

test("database integration: startDailySession, resume same day, idempotency, wrong-answer reinsertion, completion", async () => {
  const user = await User.create({
    name: "Commuter Runner",
    email: "runner@example.com",
    passwordHash: "hash1234",
    role: "USER",
    dailyQuestionGoal: 10,
  });

  // Create 5 Vocab words
  const vocabIds: Types.ObjectId[] = [];
  for (let i = 1; i <= 5; i++) {
    const w = await VocabularyWord.create({
      userId: user._id,
      word: `apple_${i}`,
      translation: `olma_${i}`,
      status: "NEW",
    });
    vocabIds.push(w._id);
  }

  // Create 3 Synonym groups
  const synIds: Types.ObjectId[] = [];
  for (let i = 1; i <= 3; i++) {
    const g = await SynonymGroup.create({
      userId: user._id,
      term: `big_${i}`,
      synonyms: [{ word: `large_${i}`, meaning: "huge" }],
      status: "NEW",
    });
    synIds.push(g._id);
  }

  // Create 2 Grammar exercises
  const topic = await GrammarTopic.create({
    userId: user._id,
    title: "Past Simple",
    normalizedTitle: "past simple",
    category: "MODAL_VERBS",
    description: "Past simple topic",
    content: "Content about past simple",
    status: "NEW",
  });

  await GrammarExercise.create({
    userId: user._id,
    grammarTopicId: topic._id,
    type: "MULTIPLE_CHOICE",
    question: "Yesterday I _____ to the cinema.",
    options: ["go", "went", "gone", "goes"],
    correctAnswer: "went",
    explanation: "Past simple of go is went.",
    order: 1,
  });

  await GrammarExercise.create({
    userId: user._id,
    grammarTopicId: topic._id,
    type: "MULTIPLE_CHOICE",
    question: "She _____ coffee this morning.",
    options: ["drink", "drank", "drunk", "drinks"],
    correctAnswer: "drank",
    explanation: "Past simple of drink is drank.",
    order: 2,
  });

  // 1. Start Daily Session
  const sessionId = await startDailySession(user._id, { goalOverride: 10 });
  assert.ok(sessionId);

  // 2. Calling startDailySession again returns SAME session (resumes without creating duplicate!)
  const sameSessionId = await startDailySession(user._id);
  assert.equal(sameSessionId, sessionId);

  // 3. Load Session State
  const state = await getDailySessionState(sessionId, user._id);
  assert.equal(state.totalQuestions, 10);
  assert.equal(state.answeredQuestions, 0);
  assert.equal(state.isCompleted, false);
  assert.equal(state.questions.length, 10);

  // Verify stable identity: each question has unique sessionItemId and correct module
  const ids = new Set(state.questions.map((q) => q.sessionItemId));
  assert.equal(ids.size, 10);

  async function getAuthoritativeAnswer(q: DailyQuestionDTO): Promise<string> {
    if (q.module === "GRAMMAR") {
      const ex = await GrammarExercise.findById(q.sourceId);
      return ex?.correctAnswer || "";
    } else if (q.module === "SYNONYMS") {
      const g = await SynonymGroup.findById(q.sourceId);
      return g?.synonyms[0]?.word || g?.term || "";
    } else {
      const w = await VocabularyWord.findById(q.sourceId);
      if (
        q.exerciseType === "UZ_TO_EN" ||
        q.exerciseType === "TYPING" ||
        q.exerciseType === "FILL_BLANK"
      ) {
        return w?.word || "";
      }
      return w?.translation || "";
    }
  }

  // 4. Answer First Question Correctly
  const firstQ = state.questions[0];
  assert.equal(
    firstQ.correctAnswers,
    undefined,
    "Unanswered question must NOT expose correct answers to client",
  );
  const firstAns = await getAuthoritativeAnswer(firstQ);
  const res1 = await submitDailyAnswer(
    sessionId,
    firstQ.sessionItemId,
    firstAns,
    8,
    user._id,
  );

  assert.equal(res1.isCorrect, true);
  assert.equal(res1.answeredQuestions, 1);
  assert.equal(res1.isCompleted, false);

  // Idempotency: submitting answer again returns alreadyAnswered: true without incrementing count
  const dupRes = await submitDailyAnswer(
    sessionId,
    firstQ.sessionItemId,
    firstAns,
    8,
    user._id,
  );
  assert.equal(dupRes.alreadyAnswered, true);

  // 5. Answer Grammar Question Incorrectly to test wrong-answer reinsertion
  const grammarQ = state.questions.find((q) => q.module === "GRAMMAR");
  assert.ok(grammarQ, "Expected at least one grammar question in queue");

  const wrongRes = await submitDailyAnswer(
    sessionId,
    grammarQ.sessionItemId,
    "wrong_answer_xyz",
    12,
    user._id,
  );

  assert.equal(wrongRes.isCorrect, false);
  assert.ok(wrongRes.reinsertedQuestion);
  const reinserted = wrongRes.reinsertedQuestion;
  assert.equal(
    reinserted.sourceId,
    grammarQ.sourceId,
    "Reinserted grammar exercise must retain EXACT SAME exercise source ID",
  );
  assert.equal(reinserted.module, "GRAMMAR");
  assert.equal(reinserted.exerciseType, "MULTIPLE_CHOICE");
  assert.ok(
    reinserted.prompt !== "MULTIPLE_CHOICE",
    "Prompt must be the actual question, NOT the type name",
  );
  assert.equal(reinserted.prompt, grammarQ.prompt);
  assert.ok(
    Array.isArray(reinserted.options) && reinserted.options.length === 4,
    "Options must be populated with choices",
  );
  assert.equal(
    reinserted.correctAnswers,
    undefined,
    "Unanswered retry question must not expose correct answers",
  );
  assert.ok(reinserted.grammarTopicId, "grammarTopicId must be preserved");
  assert.equal(wrongRes.totalQuestions, 11, "Queue extended by 1 for retry");

  // 6. Complete all remaining questions in the session
  let updatedState = await getDailySessionState(sessionId, user._id);
  while (!updatedState.isCompleted) {
    const nextQ = updatedState.questions.find((q) => !q.isAnswered);
    if (!nextQ) break;

    const ans = await getAuthoritativeAnswer(nextQ);
    await submitDailyAnswer(sessionId, nextQ.sessionItemId, ans, 6, user._id);
    updatedState = await getDailySessionState(sessionId, user._id);
  }

  assert.equal(updatedState.isCompleted, true);

  // 7. Check Summary
  const summary = await getDailySessionSummary(sessionId, user._id);
  assert.equal(summary.answeredQuestions, 11);
  assert.equal(summary.incorrectAnswers, 1);
  assert.ok(summary.overallAccuracy > 80);
  assert.ok(summary.activeStudySeconds > 0);
  assert.equal(
    summary.currentStreak,
    1,
    "Completed daily session contributes to streak",
  );
});

test("regression: multiple Grammar MULTIPLE_CHOICE items in mixed DAILY session and retry preserve complete canonical identity and options", async () => {
  const user = await User.create({
    name: "Grammar Mixed Tester",
    email: "grammartest@example.com",
    passwordHash: "hash1234",
    role: "USER",
    dailyQuestionGoal: 10,
  });

  // Create 2 Vocab words
  await VocabularyWord.create({
    userId: user._id,
    word: "meticulous",
    translation: "mayda-chuydasigacha e'tiborli",
    status: "NEW",
  });
  await VocabularyWord.create({
    userId: user._id,
    word: "diligent",
    translation: "qunt bilan ishlaydigan",
    status: "NEW",
  });

  // Create 1 Synonym group
  await SynonymGroup.create({
    userId: user._id,
    term: "fast",
    synonyms: [{ word: "quick", meaning: "moving fast" }],
    status: "NEW",
  });

  // Create Grammar Topic
  const topic = await GrammarTopic.create({
    userId: user._id,
    title: "Modal Verbs",
    normalizedTitle: "modal verbs",
    category: "MODAL_VERBS",
    description: "Modals of ability",
    content: "Could and was able to",
    status: "NEW",
  });

  // Create 2 distinct Grammar exercises
  const grammarEx1 = await GrammarExercise.create({
    userId: user._id,
    grammarTopicId: topic._id,
    type: "MULTIPLE_CHOICE",
    question: "My little sister _____ read when she was only four.",
    options: ["can", "could", "will be able to", "has been able to"],
    correctAnswer: "could",
    explanation: "'Could' is used for general past ability.",
    order: 1,
  });

  const grammarEx2 = await GrammarExercise.create({
    userId: user._id,
    grammarTopicId: topic._id,
    type: "MULTIPLE_CHOICE",
    question: "We _____ reach the summit despite the heavy storm yesterday.",
    options: ["could", "were able to", "can", "will"],
    correctAnswer: "were able to",
    explanation:
      "For success in a specific difficult past situation, use was/were able to.",
    order: 2,
  });

  // Start mixed daily session
  const sessionId = await startDailySession(user._id, { goalOverride: 5 });
  const state = await getDailySessionState(sessionId, user._id);

  // Locate the two grammar questions
  const grammarQs = state.questions.filter((q) => q.module === "GRAMMAR");
  assert.equal(
    grammarQs.length,
    2,
    "Expected 2 grammar questions in mixed session",
  );

  const q1 = grammarQs[0];
  const q2 = grammarQs[1];

  // 1. Verify First Grammar Question renders correctly
  assert.equal(q1.module, "GRAMMAR");
  assert.equal(q1.exerciseType, "MULTIPLE_CHOICE");
  assert.equal(q1.prompt, grammarEx1.question);
  assert.ok(
    q1.prompt !== "MULTIPLE_CHOICE",
    "Question prompt must not be type name",
  );
  assert.ok(Array.isArray(q1.options) && q1.options.length === 4);
  assert.equal(new Set(q1.options).size, 4, "Options must be unique");
  assert.equal(q1.sourceId, grammarEx1._id.toString());
  assert.equal(q1.grammarTopicId, topic._id.toString());
  assert.equal(q1.topicTitle, "Modal Verbs");
  assert.equal(
    q1.correctAnswers,
    undefined,
    "Must NOT leak correct answer before submission",
  );

  // 2. Intentionally answer first grammar question INCORRECTLY
  const wrongRes = await submitDailyAnswer(
    sessionId,
    q1.sessionItemId,
    "can", // wrong answer
    5,
    user._id,
  );

  assert.equal(wrongRes.isCorrect, false);
  assert.equal(wrongRes.correctAnswer, "could");
  assert.equal(
    wrongRes.explanation,
    "'Could' is used for general past ability.",
  );
  assert.ok(wrongRes.reinsertedQuestion, "Retry question must be reinserted");

  // Verify reinserted question payload
  const retryQ = wrongRes.reinsertedQuestion;
  assert.equal(retryQ.module, "GRAMMAR");
  assert.equal(retryQ.exerciseType, "MULTIPLE_CHOICE");
  assert.equal(retryQ.sourceId, grammarEx1._id.toString());
  assert.equal(retryQ.grammarTopicId, topic._id.toString());
  assert.equal(retryQ.prompt, grammarEx1.question);
  assert.ok(
    retryQ.prompt !== "MULTIPLE_CHOICE",
    "Reinserted prompt must NOT be literal 'MULTIPLE_CHOICE'",
  );
  assert.ok(Array.isArray(retryQ.options) && retryQ.options.length === 4);
  assert.deepEqual(retryQ.options, grammarEx1.options);
  assert.equal(
    retryQ.correctAnswers,
    undefined,
    "Retry question must not expose correct answers prematurely",
  );

  // 3. Verify Second, different Grammar MULTIPLE_CHOICE question
  assert.equal(q2.module, "GRAMMAR");
  assert.equal(q2.exerciseType, "MULTIPLE_CHOICE");
  assert.equal(q2.prompt, grammarEx2.question);
  assert.ok(
    q2.prompt !== "MULTIPLE_CHOICE",
    "Second grammar prompt must not be 'MULTIPLE_CHOICE'",
  );
  assert.ok(Array.isArray(q2.options) && q2.options.length === 4);
  assert.deepEqual(q2.options, grammarEx2.options);
  assert.equal(q2.sourceId, grammarEx2._id.toString());

  // 4. Submit valid answer to Second Grammar Question
  const resQ2 = await submitDailyAnswer(
    sessionId,
    q2.sessionItemId,
    "were able to",
    6,
    user._id,
  );
  assert.equal(resQ2.isCorrect, true);
  assert.equal(resQ2.correctAnswer, "were able to");

  // 5. Submit valid answer to retried First Grammar Question
  const resRetry = await submitDailyAnswer(
    sessionId,
    retryQ.sessionItemId,
    "could",
    7,
    user._id,
  );
  assert.equal(resRetry.isCorrect, true);
  assert.equal(resRetry.correctAnswer, "could");
});

test("all 5 Grammar exercise types produce complete canonical payload and grading inside DAILY mixed session", async () => {
  const user = await User.create({
    name: "All Types Tester",
    email: "alltypes@example.com",
    passwordHash: "hash1234",
    role: "USER",
    dailyQuestionGoal: 10,
  });

  const topic = await GrammarTopic.create({
    userId: user._id,
    title: "Comprehensive Grammar",
    normalizedTitle: "comprehensive grammar",
    category: "TENSES",
    description: "All exercise types",
    content: "Grammar rules",
    status: "NEW",
  });

  // 1. MULTIPLE_CHOICE
  const exMC = await GrammarExercise.create({
    userId: user._id,
    grammarTopicId: topic._id,
    type: "MULTIPLE_CHOICE",
    question: "She _____ to Paris last summer.",
    options: ["goes", "went", "gone", "going"],
    correctAnswer: "went",
    explanation: "Past tense of go.",
    order: 1,
  });

  // 2. FILL_BLANK
  const exFB = await GrammarExercise.create({
    userId: user._id,
    grammarTopicId: topic._id,
    type: "FILL_BLANK",
    question: "If I _____ you, I would study harder.",
    options: [],
    correctAnswer: "were",
    acceptedAnswers: ["was"],
    explanation: "Subjunctive 'were' is standard in conditionals.",
    order: 2,
  });

  // 3. TEXT_INPUT
  const exTI = await GrammarExercise.create({
    userId: user._id,
    grammarTopicId: topic._id,
    type: "TEXT_INPUT",
    question: "Transform to passive: 'The cat ate the mouse.'",
    options: [],
    correctAnswer: "The mouse was eaten by the cat",
    acceptedAnswers: ["The mouse was eaten by the cat."],
    explanation: "Passive form: object + was eaten + by subject.",
    order: 3,
  });

  // 4. TRUE_FALSE
  const exTF = await GrammarExercise.create({
    userId: user._id,
    grammarTopicId: topic._id,
    type: "TRUE_FALSE",
    question: "'Must' and 'have to' have identical meanings in the negative.",
    options: [],
    correctAnswer: "false",
    explanation:
      "'Mustn't' means prohibition, whereas 'don't have to' means lack of obligation.",
    order: 4,
  });

  // 5. SENTENCE_CORRECTION
  const exSC = await GrammarExercise.create({
    userId: user._id,
    grammarTopicId: topic._id,
    type: "SENTENCE_CORRECTION",
    question: "He don't know the answer.",
    options: [],
    correctAnswer: "He doesn't know the answer",
    acceptedAnswers: ["He doesn't know the answer."],
    explanation: "Third person singular takes 'does not / doesn't'.",
    order: 5,
  });

  // Create 1 Vocab word to ensure mixed session
  await VocabularyWord.create({
    userId: user._id,
    word: "eloquent",
    translation: "notiq, fasih",
    status: "NEW",
  });

  const sessionId = await startDailySession(user._id, { goalOverride: 6 });
  const state = await getDailySessionState(sessionId, user._id);

  // Check MULTIPLE_CHOICE
  const qMC = state.questions.find((q) => q.sourceId === exMC._id.toString());
  assert.ok(qMC);
  assert.equal(qMC.exerciseType, "MULTIPLE_CHOICE");
  assert.equal(qMC.prompt, exMC.question);
  assert.deepEqual(qMC.options, exMC.options);
  assert.equal(qMC.correctAnswers, undefined);

  // Check FILL_BLANK
  const qFB = state.questions.find((q) => q.sourceId === exFB._id.toString());
  assert.ok(qFB);
  assert.equal(qFB.exerciseType, "FILL_BLANK");
  assert.equal(qFB.prompt, exFB.question);
  assert.equal(qFB.options, undefined);

  // Check TEXT_INPUT
  const qTI = state.questions.find((q) => q.sourceId === exTI._id.toString());
  assert.ok(qTI);
  assert.equal(qTI.exerciseType, "TEXT_INPUT");
  assert.equal(qTI.prompt, exTI.question);
  assert.equal(qTI.options, undefined);

  // Check TRUE_FALSE
  const qTF = state.questions.find((q) => q.sourceId === exTF._id.toString());
  assert.ok(qTF);
  assert.equal(qTF.exerciseType, "TRUE_FALSE");
  assert.equal(qTF.prompt, exTF.question);
  assert.deepEqual(
    qTF.options,
    ["True", "False"],
    "TRUE_FALSE must provide True and False options",
  );

  // Check SENTENCE_CORRECTION
  const qSC = state.questions.find((q) => q.sourceId === exSC._id.toString());
  assert.ok(qSC);
  assert.equal(qSC.exerciseType, "SENTENCE_CORRECTION");
  assert.equal(qSC.prompt, exSC.question);
  assert.equal(qSC.options, undefined);

  // Test submissions and grading for each type
  const resMC = await submitDailyAnswer(
    sessionId,
    qMC.sessionItemId,
    "went",
    5,
    user._id,
  );
  assert.equal(resMC.isCorrect, true);

  const resFB = await submitDailyAnswer(
    sessionId,
    qFB.sessionItemId,
    "were",
    5,
    user._id,
  );
  assert.equal(resFB.isCorrect, true);

  const resTI = await submitDailyAnswer(
    sessionId,
    qTI.sessionItemId,
    "the mouse was eaten by the cat",
    5,
    user._id,
  );
  assert.equal(resTI.isCorrect, true);

  const resTF = await submitDailyAnswer(
    sessionId,
    qTF.sessionItemId,
    "False",
    5,
    user._id,
  );
  assert.equal(resTF.isCorrect, true);

  // Intentionally answer SENTENCE_CORRECTION wrong to verify text-type retry payload
  const resSCWrong = await submitDailyAnswer(
    sessionId,
    qSC.sessionItemId,
    "He not know",
    5,
    user._id,
  );
  assert.equal(resSCWrong.isCorrect, false);
  assert.ok(resSCWrong.reinsertedQuestion);
  assert.equal(
    resSCWrong.reinsertedQuestion.exerciseType,
    "SENTENCE_CORRECTION",
  );
  assert.equal(resSCWrong.reinsertedQuestion.prompt, exSC.question);
  assert.ok(resSCWrong.reinsertedQuestion.prompt !== "SENTENCE_CORRECTION");
  assert.equal(resSCWrong.reinsertedQuestion.options, undefined);

  // Submit correct answer to reinserted SENTENCE_CORRECTION
  const resSCCorrect = await submitDailyAnswer(
    sessionId,
    resSCWrong.reinsertedQuestion.sessionItemId,
    "He doesn't know the answer",
    5,
    user._id,
  );
  assert.equal(resSCCorrect.isCorrect, true);
});

test("regression: full manual commute sequence (Vocab -> Synonym -> Grammar wrong -> second Grammar -> refresh -> retry -> finish)", async () => {
  const user = await User.create({
    name: "Commute Manual Tester",
    email: "manualtester@example.com",
    passwordHash: "hash1234",
    role: "USER",
    dailyQuestionGoal: 10,
  });

  // Create 2 Vocab
  await VocabularyWord.create({
    userId: user._id,
    word: "persevere",
    translation: "matonat ko'rsatmoq",
    status: "NEW",
  });
  await VocabularyWord.create({
    userId: user._id,
    word: "adaptable",
    translation: "moslashuvchan",
    status: "NEW",
  });

  // Create 1 Synonym
  await SynonymGroup.create({
    userId: user._id,
    term: "courageous",
    synonyms: [{ word: "brave", meaning: "showing courage" }],
    status: "NEW",
  });

  // Create Grammar Topic with 2 MULTIPLE_CHOICE exercises
  const topic = await GrammarTopic.create({
    userId: user._id,
    title: "Modal Verbs",
    normalizedTitle: "modal verbs",
    category: "MODAL_VERBS",
    description: "Ability in past and present",
    content: "Grammar rules",
    status: "NEW",
  });

  const gEx1 = await GrammarExercise.create({
    userId: user._id,
    grammarTopicId: topic._id,
    type: "MULTIPLE_CHOICE",
    question: "My little sister _____ read when she was only four.",
    options: ["can", "could", "will be able to", "has been able to"],
    correctAnswer: "could",
    explanation: "'Could' is used for general past ability.",
    order: 1,
  });

  const gEx2 = await GrammarExercise.create({
    userId: user._id,
    grammarTopicId: topic._id,
    type: "MULTIPLE_CHOICE",
    question: "The fire was huge, but the firefighters _____ rescue everyone.",
    options: ["could", "were able to", "can", "are able to"],
    correctAnswer: "were able to",
    explanation: "Specific past achievement requires was/were able to.",
    order: 2,
  });

  // 1. Start Today session
  const sessionId = await startDailySession(user._id, { goalOverride: 5 });
  let state = await getDailySessionState(sessionId, user._id);
  assert.equal(state.isCompleted, false);

  // Initial questions should have 5 items
  assert.ok(state.questions.length >= 4);

  // 2. Answer Vocab items
  const qVocab0 = state.questions[0];
  assert.equal(qVocab0.module, "VOCABULARY");
  await submitDailyAnswer(
    sessionId,
    qVocab0.sessionItemId,
    qVocab0.prompt === "persevere" ? "matonat ko'rsatmoq" : "moslashuvchan",
    5,
    user._id,
  );

  state = await getDailySessionState(sessionId, user._id);
  const qVocab1 = state.questions[1];
  assert.equal(qVocab1.module, "VOCABULARY");
  await submitDailyAnswer(
    sessionId,
    qVocab1.sessionItemId,
    qVocab1.prompt === "persevere" ? "matonat ko'rsatmoq" : "moslashuvchan",
    5,
    user._id,
  );

  // 3. Answer Synonym
  state = await getDailySessionState(sessionId, user._id);
  const qSyn = state.questions[2];
  assert.equal(qSyn.module, "SYNONYMS");
  await submitDailyAnswer(sessionId, qSyn.sessionItemId, "brave", 5, user._id);

  // 4. Grammar 1 -> intentional wrong answer ("xato")
  state = await getDailySessionState(sessionId, user._id);
  const qGrammar1 = state.questions[3];
  assert.equal(qGrammar1.module, "GRAMMAR");
  assert.equal(qGrammar1.exerciseType, "MULTIPLE_CHOICE");
  assert.equal(qGrammar1.prompt, gEx1.question);
  assert.ok(Array.isArray(qGrammar1.options) && qGrammar1.options.length === 4);

  const wrongRes = await submitDailyAnswer(
    sessionId,
    qGrammar1.sessionItemId,
    "can", // wrong answer
    5,
    user._id,
  );
  assert.equal(wrongRes.isCorrect, false);
  assert.equal(wrongRes.correctAnswer, "could");
  assert.ok(wrongRes.reinsertedQuestion);
  assert.equal(wrongRes.reinsertedQuestion.prompt, gEx1.question);
  assert.ok(
    Array.isArray(wrongRes.reinsertedQuestion.options) &&
      wrongRes.reinsertedQuestion.options.length === 4,
  );

  // 5. Browser refresh simulation
  state = await getDailySessionState(sessionId, user._id);

  // 6. Next question: Second Grammar question ("boshqa Grammar")
  const qGrammar2 = state.questions[4];
  assert.equal(qGrammar2.module, "GRAMMAR");
  assert.equal(qGrammar2.exerciseType, "MULTIPLE_CHOICE");
  assert.equal(qGrammar2.prompt, gEx2.question);
  assert.ok(
    qGrammar2.prompt !== "MULTIPLE_CHOICE",
    "Second grammar prompt must be actual question text, NOT 'MULTIPLE_CHOICE'",
  );
  assert.ok(
    Array.isArray(qGrammar2.options) && qGrammar2.options.length === 4,
    "Second grammar options must NOT disappear and must have 4 choices",
  );
  assert.deepEqual(qGrammar2.options, gEx2.options);

  // 7. Answer Second Grammar correctly
  const resG2 = await submitDailyAnswer(
    sessionId,
    qGrammar2.sessionItemId,
    "were able to",
    5,
    user._id,
  );
  assert.equal(resG2.isCorrect, true);

  // 8. Re-hydrated retry question arrives
  state = await getDailySessionState(sessionId, user._id);
  const qRetry = state.questions[5];
  assert.equal(qRetry.module, "GRAMMAR");
  assert.equal(qRetry.exerciseType, "MULTIPLE_CHOICE");
  assert.equal(qRetry.prompt, gEx1.question);
  assert.ok(Array.isArray(qRetry.options) && qRetry.options.length === 4);

  // 9. Answer retried Grammar 1 correctly
  const resRetry = await submitDailyAnswer(
    sessionId,
    qRetry.sessionItemId,
    "could",
    5,
    user._id,
  );
  assert.equal(resRetry.isCorrect, true);

  // 10. Verify session completion
  const finalSummary = await getDailySessionSummary(sessionId, user._id);
  assert.ok(finalSummary);
  assert.equal(finalSummary.answeredQuestions, 6);
  assert.equal(finalSummary.correctAnswers, 5);
  assert.equal(finalSummary.mistakesCount, 1);
});
