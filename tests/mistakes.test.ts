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
import mongoose from "mongoose";
import { User } from "@/models/user";
import { VocabularyWord } from "@/models/vocabulary-word";
import { VocabularyAttempt } from "@/models/vocabulary-attempt";
import { SynonymGroup } from "@/models/synonym-group";
import { SynonymAttempt } from "@/models/synonym-attempt";
import { GrammarTopic } from "@/models/grammar-topic";
import { GrammarExercise } from "@/models/grammar-exercise";
import { GrammarAttempt } from "@/models/grammar-attempt";
import { StudySession } from "@/models/study-session";

let isMistakeResolved: (typeof import("../src/services/mistakes"))["isMistakeResolved"];
let getUnifiedMistakes: (typeof import("../src/services/mistakes"))["getUnifiedMistakes"];
let startMistakesPracticeSession: (typeof import("../src/services/mistakes"))["startMistakesPracticeSession"];

let mongod: MongoMemoryServer;

test.before(async () => {
  const mod = await import("../src/services/mistakes");
  isMistakeResolved = mod.isMistakeResolved;
  getUnifiedMistakes = mod.getUnifiedMistakes;
  startMistakesPracticeSession = mod.startMistakesPracticeSession;

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

test("isMistakeResolved: deterministic resolution rule", () => {
  // Last attempt incorrect -> unresolved (false)
  assert.equal(isMistakeResolved([{ isCorrect: false }]), false);
  assert.equal(
    isMistakeResolved([{ isCorrect: false }, { isCorrect: true }]),
    false,
  );

  // Last attempt correct, but only 1 correct attempt after mistake -> unresolved (false)
  assert.equal(
    isMistakeResolved([{ isCorrect: true }, { isCorrect: false }]),
    false,
  );

  // Last TWO consecutive attempts correct -> resolved (true)
  assert.equal(
    isMistakeResolved([
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: false },
    ]),
    true,
  );

  // Empty attempt list -> considered resolved
  assert.equal(isMistakeResolved([]), true);
});

test("database integration: aggregation across 3 modules, resolution tracking, and user isolation", async () => {
  const userA = await User.create({
    name: "User A",
    email: "userA@example.com",
    passwordHash: "hash1234",
    role: "USER",
  });

  const userB = await User.create({
    name: "User B",
    email: "userB@example.com",
    passwordHash: "hash1234",
    role: "USER",
  });

  const sessionA = await StudySession.create({
    userId: userA._id,
    module: "MIXED",
    type: "DAILY",
  });

  // 1. User A Vocabulary Word with 2 mistakes
  const word = await VocabularyWord.create({
    userId: userA._id,
    word: "appropriate",
    translation: "mos, to'g'ri",
    status: "DIFFICULT",
  });

  await VocabularyAttempt.create({
    userId: userA._id,
    vocabularyWordId: word._id,
    studySessionId: sessionA._id,
    exerciseType: "EN_TO_UZ",
    prompt: "appropriate",
    userAnswer: "noto'g'ri",
    correctAnswer: "mos, to'g'ri",
    isCorrect: false,
    rating: "AGAIN",
    createdAt: new Date(Date.now() - 3600000),
  });

  await VocabularyAttempt.create({
    userId: userA._id,
    vocabularyWordId: word._id,
    studySessionId: sessionA._id,
    exerciseType: "EN_TO_UZ",
    prompt: "appropriate",
    userAnswer: "xato",
    correctAnswer: "mos, to'g'ri",
    isCorrect: false,
    rating: "AGAIN",
    createdAt: new Date(),
  });

  // 2. User A Synonym Group with 1 mistake, then resolved with 2 correct attempts!
  const group = await SynonymGroup.create({
    userId: userA._id,
    term: "fast",
    synonyms: [{ word: "quick", meaning: "rapid" }],
    status: "LEARNED",
  });

  await SynonymAttempt.create({
    userId: userA._id,
    synonymGroupId: group._id,
    studySessionId: sessionA._id,
    exerciseType: "RECOGNITION",
    prompt: "fast",
    userAnswer: "slow",
    correctAnswer: "quick",
    isCorrect: false,
    rating: "AGAIN",
    createdAt: new Date(Date.now() - 7200000),
  });

  // Subsequent correct attempts
  await SynonymAttempt.create({
    userId: userA._id,
    synonymGroupId: group._id,
    studySessionId: sessionA._id,
    exerciseType: "RECOGNITION",
    prompt: "fast",
    userAnswer: "quick",
    correctAnswer: "quick",
    isCorrect: true,
    rating: "GOOD",
    createdAt: new Date(Date.now() - 3600000),
  });

  await SynonymAttempt.create({
    userId: userA._id,
    synonymGroupId: group._id,
    studySessionId: sessionA._id,
    exerciseType: "RECOGNITION",
    prompt: "fast",
    userAnswer: "quick",
    correctAnswer: "quick",
    isCorrect: true,
    rating: "GOOD",
    createdAt: new Date(),
  });

  // 3. User A Grammar Exercise with 1 unresolved mistake
  const topic = await GrammarTopic.create({
    userId: userA._id,
    title: "Modal Verbs — Ability",
    normalizedTitle: "modal verbs — ability",
    category: "MODAL_VERBS",
    description: "Can, could, be able to",
    content: "Can is used for present ability.",
    status: "NEW",
  });

  const grammarEx = await GrammarExercise.create({
    userId: userA._id,
    grammarTopicId: topic._id,
    type: "MULTIPLE_CHOICE",
    question: "My little sister _____ read when she was only four.",
    options: ["can", "could", "will be able to", "has been able to"],
    correctAnswer: "could",
    explanation: "'Could' is used for general past ability.",
    order: 1,
  });

  await GrammarAttempt.create({
    userId: userA._id,
    grammarTopicId: topic._id,
    grammarExerciseId: grammarEx._id,
    studySessionId: sessionA._id,
    exerciseType: "MULTIPLE_CHOICE",
    prompt: grammarEx.question,
    userAnswer: "can",
    normalizedAnswer: "can",
    correctAnswer: "could",
    isCorrect: false,
    createdAt: new Date(),
  });

  // 4. Query Unified Mistakes for User A
  const summaryA = await getUnifiedMistakes(userA._id, {
    module: "ALL",
    sort: "UNRESOLVED",
  });

  assert.equal(summaryA.totalMistakesCount, 3); // 1 vocab + 1 syn + 1 grammar
  assert.equal(summaryA.unresolvedCount, 2); // vocab & grammar are unresolved
  assert.equal(summaryA.resolvedCount, 1); // synonym was resolved by 2 correct attempts!
  assert.equal(summaryA.items.length, 2); // filter UNRESOLVED returns only the 2 unresolved

  // Verify details on unresolved vocab mistake
  const vocabMistake = summaryA.items.find((i) => i.module === "VOCABULARY");
  assert.ok(vocabMistake);
  assert.equal(vocabMistake.title, "appropriate");
  assert.equal(vocabMistake.mistakesCount, 2);
  assert.equal(vocabMistake.latestWrongAnswer, "xato");

  // Verify details on unresolved grammar mistake
  const grammarMistake = summaryA.items.find((i) => i.module === "GRAMMAR");
  assert.ok(grammarMistake);
  assert.equal(grammarMistake.subTitle, "Modal Verbs — Ability");
  assert.equal(grammarMistake.latestWrongAnswer, "can");
  assert.equal(grammarMistake.correctAnswer, "could");

  // 5. Query for User B (User Isolation Test)
  const summaryB = await getUnifiedMistakes(userB._id);
  assert.equal(summaryB.totalMistakesCount, 0);
  assert.equal(summaryB.items.length, 0);

  // 6. Test Practice All Mistakes Session Creation
  const mistakeSessionId = await startMistakesPracticeSession("ALL", userA._id);
  assert.ok(mistakeSessionId);

  const mistakeSession = await StudySession.findById(mistakeSessionId).lean();
  assert.ok(mistakeSession);
  assert.equal(mistakeSession.type, "MISTAKES");
  assert.equal(mistakeSession.module, "MIXED");
  assert.equal(mistakeSession.items.length, 2);
});
