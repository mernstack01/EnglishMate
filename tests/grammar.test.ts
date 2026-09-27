import test from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  normalizeGrammarTitle,
  normalizeGrammarAnswer,
  normalizeBooleanString,
  isGrammarAnswerAccepted,
} from "../src/features/grammar/constants";
import {
  grammarTopicInputSchema,
  grammarExerciseInputSchema,
  parseGrammarImportJson,
} from "../src/validations/grammar";
import { GrammarTopic } from "../src/models/grammar-topic";
import { GrammarExercise } from "../src/models/grammar-exercise";
import { GrammarAttempt } from "../src/models/grammar-attempt";
import { StudySession } from "../src/models/study-session";
import { calculateStreakFromDates } from "../src/lib/streak";
import { dateKey } from "../src/lib/dates";
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

// 1. Normalization & Answer Evaluation Tests
test("grammar normalization handles whitespace, casing, terminal punctuation and apostrophes correctly", () => {
  // Title normalization
  assert.equal(
    normalizeGrammarTitle("  Modal   Verbs — Ability  "),
    "modal verbs — ability",
  );
  assert.equal(normalizeGrammarTitle("ＰＲＥＳＥＮＴ"), "present");

  // Answer normalization
  assert.equal(normalizeGrammarAnswer("  Could  "), "could");
  assert.equal(normalizeGrammarAnswer("Could."), "could");
  assert.equal(normalizeGrammarAnswer("Could!"), "could");
  assert.equal(normalizeGrammarAnswer("Could?"), "could");
  assert.equal(normalizeGrammarAnswer("was   able   to"), "was able to");

  // Preserves internal apostrophes
  assert.equal(normalizeGrammarAnswer("can't"), "can't");
  assert.equal(normalizeGrammarAnswer("couldn't"), "couldn't");
  assert.notEqual(
    normalizeGrammarAnswer("can't"),
    normalizeGrammarAnswer("cant"),
  );
  assert.notEqual(
    normalizeGrammarAnswer("couldn't"),
    normalizeGrammarAnswer("could"),
  );

  // Boolean normalization
  assert.equal(normalizeBooleanString("true"), "true");
  assert.equal(normalizeBooleanString("True"), "true");
  assert.equal(normalizeBooleanString("T"), "true");
  assert.equal(normalizeBooleanString(true), "true");
  assert.equal(normalizeBooleanString("false"), "false");
  assert.equal(normalizeBooleanString("False"), "false");
  assert.equal(normalizeBooleanString(false), "false");
  assert.equal(normalizeBooleanString("other"), null);

  // isGrammarAnswerAccepted
  assert.ok(
    isGrammarAnswerAccepted("MULTIPLE_CHOICE", "could", "could", ["could"]),
  );
  assert.ok(
    isGrammarAnswerAccepted("MULTIPLE_CHOICE", "  COULD  ", "could", ["could"]),
  );
  assert.ok(
    !isGrammarAnswerAccepted("MULTIPLE_CHOICE", "can", "could", ["could"]),
  );

  assert.ok(
    isGrammarAnswerAccepted("FILL_BLANK", "was able to", "was able to", [
      "was able to",
      "managed to",
    ]),
  );
  assert.ok(
    isGrammarAnswerAccepted("FILL_BLANK", "managed to.", "was able to", [
      "was able to",
      "managed to",
    ]),
  );
  assert.ok(
    !isGrammarAnswerAccepted("FILL_BLANK", "could", "was able to", [
      "was able to",
    ]),
  );

  assert.ok(isGrammarAnswerAccepted("TRUE_FALSE", "true", "true", ["true"]));
  assert.ok(isGrammarAnswerAccepted("TRUE_FALSE", "TRUE", "true", ["true"]));
  assert.ok(!isGrammarAnswerAccepted("TRUE_FALSE", "false", "true", ["true"]));

  assert.ok(
    isGrammarAnswerAccepted(
      "SENTENCE_CORRECTION",
      "He can swim.",
      "He can swim",
      ["He can swim", "He can swim."],
    ),
  );
});

// 2. Validation Schemas Tests
test("grammar validation schemas enforce constraints across all 5 exercise types", () => {
  // Valid topic
  const topicRes = grammarTopicInputSchema.safeParse({
    title: "Modal Verbs",
    category: "MODAL_VERBS",
    description: "Ability and permission",
  });
  assert.ok(topicRes.success);

  // Topic requires title
  const invalidTopic = grammarTopicInputSchema.safeParse({
    title: "   ",
  });
  assert.equal(invalidTopic.success, false);

  // MULTIPLE_CHOICE: correctAnswer must be in options
  const validMcq = grammarExerciseInputSchema.safeParse({
    type: "MULTIPLE_CHOICE",
    question: "She _____ swim.",
    options: ["can", "could", "must"],
    correctAnswer: "can",
  });
  assert.ok(validMcq.success);

  const invalidMcqCorrect = grammarExerciseInputSchema.safeParse({
    type: "MULTIPLE_CHOICE",
    question: "She _____ swim.",
    options: ["could", "must"],
    correctAnswer: "can", // Not in options!
  });
  assert.equal(invalidMcqCorrect.success, false);

  // MULTIPLE_CHOICE: duplicate options rejected
  const dupMcq = grammarExerciseInputSchema.safeParse({
    type: "MULTIPLE_CHOICE",
    question: "She _____ swim.",
    options: ["can", "Can", "could"], // duplicate after normalization
    correctAnswer: "can",
  });
  assert.equal(dupMcq.success, false);

  // TRUE_FALSE: must resolve to boolean
  const validTf = grammarExerciseInputSchema.safeParse({
    type: "TRUE_FALSE",
    question: "Could is past ability.",
    correctAnswer: "true",
  });
  assert.ok(validTf.success);

  const invalidTf = grammarExerciseInputSchema.safeParse({
    type: "TRUE_FALSE",
    question: "Could is past ability.",
    correctAnswer: "maybe",
  });
  assert.equal(invalidTf.success, false);

  // FILL_BLANK: requires accepted answers
  const validFill = grammarExerciseInputSchema.safeParse({
    type: "FILL_BLANK",
    question: "She _____ swim.",
    correctAnswer: "can",
    acceptedAnswers: ["can", "is able to"],
  });
  assert.ok(validFill.success);

  const emptyFill = grammarExerciseInputSchema.safeParse({
    type: "FILL_BLANK",
    question: "She _____ swim.",
    correctAnswer: "   ",
  });
  assert.equal(emptyFill.success, false);
});

// 3. JSON Import Parsing & Validation
test("parseGrammarImportJson handles valid topic import, mixed exercises, and invalid syntax", () => {
  // Valid topic + exercises JSON
  const validJson = JSON.stringify({
    title: "Conditionals",
    category: "CONDITIONALS",
    description: "Zero, First and Second Conditionals",
    content: "If + present simple...",
    exercises: [
      {
        type: "MULTIPLE_CHOICE",
        question: "If it rains, we _____ at home.",
        options: ["will stay", "stayed", "would stay"],
        correctAnswer: "will stay",
        explanation: "First conditional rule.",
      },
      {
        type: "FILL_BLANK",
        question: "If I were you, I _____ accept the offer.",
        correctAnswer: "would",
        acceptedAnswers: ["would"],
        explanation: "Second conditional advice.",
      },
      {
        type: "MULTIPLE_CHOICE",
        question: "Malformed MCQ with missing correct answer in options",
        options: ["option A", "option B"],
        correctAnswer: "option C", // Invalid!
      },
    ],
  });

  const preview = parseGrammarImportJson(validJson);
  assert.equal(preview.mode, "NEW_TOPIC");
  assert.equal(preview.title, "Conditionals");
  assert.equal(preview.category, "CONDITIONALS");
  assert.equal(preview.totalDetected, 3);
  assert.equal(preview.readyCount, 2);
  assert.equal(preview.invalidCount, 1);
  assert.equal(preview.exercises[0].status, "READY");
  assert.equal(preview.exercises[1].status, "READY");
  assert.equal(preview.exercises[2].status, "INVALID");

  // Invalid JSON syntax
  assert.throws(() => parseGrammarImportJson("not a json"), {
    message: /Invalid JSON format/i,
  });
});

// 4. Database Integration & Security Tests
test("database integration: CRUD, user isolation, cascading delete, study sessions, wrong-answer reinsertion and streak", async () => {
  const mongo = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongo.getUri("test_grammar"));
    await Promise.all([
      GrammarTopic.createIndexes(),
      GrammarExercise.createIndexes(),
      GrammarAttempt.createIndexes(),
      StudySession.createIndexes(),
    ]);

    const userA = new Types.ObjectId();
    const userB = new Types.ObjectId();

    // 1. Topic Creation & Normalization
    const topicA = await GrammarTopic.create({
      userId: userA,
      title: "Modal Verbs — Ability",
      normalizedTitle: normalizeGrammarTitle("Modal Verbs — Ability"),
      category: "MODAL_VERBS",
      description: "Can, could, be able to",
      content: "Can is used for present ability.",
      status: "NEW",
    });

    assert.ok(topicA._id);
    assert.equal(topicA.normalizedTitle, "modal verbs — ability");
    assert.equal(topicA.status, "NEW");

    // 2. Duplicate normalized title for same user must be rejected
    await assert.rejects(
      async () => {
        await GrammarTopic.create({
          userId: userA,
          title: "  MODAL   VERBS — ABILITY  ",
          normalizedTitle: normalizeGrammarTitle("  MODAL   VERBS — ABILITY  "),
          category: "MODAL_VERBS",
        });
      },
      (err: unknown) =>
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: number }).code === 11000,
    );

    // 3. User B can create a topic with the exact same title
    const topicB = await GrammarTopic.create({
      userId: userB,
      title: "Modal Verbs — Ability",
      normalizedTitle: normalizeGrammarTitle("Modal Verbs — Ability"),
      category: "MODAL_VERBS",
    });
    assert.ok(topicB._id);

    // 4. Security / Isolation: User A cannot read or modify User B's topic
    const readAttempt = await GrammarTopic.findOne({
      _id: topicB._id,
      userId: userA,
    });
    assert.equal(readAttempt, null);

    const updateAttempt = await GrammarTopic.updateOne(
      { _id: topicB._id, userId: userA },
      { $set: { description: "hacked" } },
    );
    assert.equal(updateAttempt.matchedCount, 0);

    // 5. Create all 5 exercise types for User A
    const exMcq = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topicA._id,
      type: "MULTIPLE_CHOICE",
      question: "My sister _____ read when she was four.",
      options: ["can", "could", "will be able to"],
      correctAnswer: "could",
      acceptedAnswers: ["could"],
      explanation: "'Could' is used for general past ability.",
      order: 0,
    });
    assert.ok(exMcq._id);

    const exFill = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topicA._id,
      type: "FILL_BLANK",
      question: "She _____ speak English when she was five.",
      correctAnswer: "could",
      acceptedAnswers: ["could"],
      order: 1,
    });
    assert.ok(exFill._id);

    const exText = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topicA._id,
      type: "TEXT_INPUT",
      question: "Rewrite using 'be able to': I can finish tomorrow.",
      correctAnswer: "I will be able to finish tomorrow.",
      acceptedAnswers: [
        "I will be able to finish tomorrow.",
        "I will be able to finish tomorrow",
      ],
      order: 2,
    });
    assert.ok(exText._id);

    const exTf = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topicA._id,
      type: "TRUE_FALSE",
      question: "'Could' can describe general past ability.",
      options: ["true", "false"],
      correctAnswer: "true",
      acceptedAnswers: ["true"],
      order: 3,
    });
    assert.ok(exTf._id);

    const exCorrection = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topicA._id,
      type: "SENTENCE_CORRECTION",
      question: "He can to swim.",
      correctAnswer: "He can swim.",
      acceptedAnswers: ["He can swim", "He can swim."],
      order: 4,
    });
    assert.ok(exCorrection._id);

    // Update topic exerciseCount
    await GrammarTopic.updateOne(
      { _id: topicA._id },
      { $set: { exerciseCount: 5 } },
    );

    // 6. Security: User B cannot access User A's exercises
    const userBExAccess = await GrammarExercise.findOne({
      _id: exMcq._id,
      userId: userB,
    });
    assert.equal(userBExAccess, null);

    // 7. Study Session Generation & Simulation
    const session = await StudySession.create({
      userId: userA,
      module: "GRAMMAR",
      grammarTopicId: topicA._id,
      type: "DAILY",
      totalQuestions: 2,
      answeredQuestions: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      items: [
        {
          grammarExerciseId: exMcq._id,
          exerciseType: "MULTIPLE_CHOICE",
          order: 0,
          answered: false,
          isCorrect: null,
          retryCount: 0,
        },
        {
          grammarExerciseId: exFill._id,
          exerciseType: "FILL_BLANK",
          order: 1,
          answered: false,
          isCorrect: null,
          retryCount: 0,
        },
      ],
    });
    assert.ok(session._id);
    assert.equal(session.module, "GRAMMAR");

    // Answer Question 0 INCORRECTLY: "can" instead of "could"
    const isCorrect0 = isGrammarAnswerAccepted(
      exMcq.type,
      "can",
      exMcq.correctAnswer,
      exMcq.acceptedAnswers,
    );
    assert.equal(isCorrect0, false);

    // Persist attempt
    await GrammarAttempt.create({
      userId: userA,
      grammarTopicId: topicA._id,
      grammarExerciseId: exMcq._id,
      studySessionId: session._id,
      exerciseType: exMcq.type,
      prompt: exMcq.question,
      userAnswer: "can",
      normalizedAnswer: normalizeGrammarAnswer("can"),
      correctAnswer: exMcq.correctAnswer,
      isCorrect: false,
    });

    // Wrong answer reinsertion: item is reinserted at the end of items
    session.items[0].answered = true;
    session.items[0].isCorrect = false;
    session.items.push({
      grammarExerciseId: exMcq._id,
      exerciseType: exMcq.type,
      order: session.items.length,
      answered: false,
      isCorrect: null,
      retryCount: 1,
    });
    session.totalQuestions = session.items.length;
    session.incorrectAnswers += 1;
    session.answeredQuestions += 1;
    await session.save();

    // Now session has 3 items (reinserted item at index 2)
    assert.equal(session.items.length, 3);
    assert.equal(
      session.items[2].grammarExerciseId?.toString(),
      exMcq._id.toString(),
    );

    // Answer Question 1 CORRECTLY: "could"
    const isCorrect1 = isGrammarAnswerAccepted(
      exFill.type,
      "could",
      exFill.correctAnswer,
      exFill.acceptedAnswers,
    );
    assert.equal(isCorrect1, true);

    await GrammarAttempt.create({
      userId: userA,
      grammarTopicId: topicA._id,
      grammarExerciseId: exFill._id,
      studySessionId: session._id,
      exerciseType: exFill.type,
      prompt: exFill.question,
      userAnswer: "could",
      normalizedAnswer: normalizeGrammarAnswer("could"),
      correctAnswer: exFill.correctAnswer,
      isCorrect: true,
    });

    session.items[1].answered = true;
    session.items[1].isCorrect = true;
    session.correctAnswers += 1;
    session.answeredQuestions += 1;

    // Answer Reinserted Question (index 2) CORRECTLY: "could"
    session.items[2].answered = true;
    session.items[2].isCorrect = true;
    session.correctAnswers += 1;
    session.answeredQuestions += 1;
    session.completedAt = new Date();
    await session.save();

    assert.equal(session.answeredQuestions, 3);
    assert.equal(session.correctAnswers, 2);
    assert.equal(session.incorrectAnswers, 1);

    // 8. Topic Status Evolution
    // After practice, topic transitions from NEW to LEARNING
    await GrammarTopic.updateOne(
      { _id: topicA._id },
      {
        $set: {
          status: "LEARNING",
          attemptsCount: 3,
          correctAttemptsCount: 2,
          accuracy: 67,
          lastPracticedAt: new Date(),
        },
      },
    );

    const updatedTopic = await GrammarTopic.findById(topicA._id);
    assert.equal(updatedTopic?.status, "LEARNING");
    assert.equal(updatedTopic?.accuracy, 67);

    // 9. Unified Streak Integration
    // Completed StudySession with module "GRAMMAR" contributes to unified streak
    const completedSessions = await StudySession.find({
      userId: userA,
      completedAt: { $ne: null },
    }).lean();
    const dates = completedSessions.map((s) => dateKey(s.completedAt!, "UTC"));
    const streak = calculateStreakFromDates(dates, dateKey(new Date(), "UTC"));
    assert.equal(streak, 1);

    // 10. Cascading Safe Delete: Deleting topicA cleans its exercises and attempts
    await Promise.all([
      GrammarTopic.deleteOne({ _id: topicA._id, userId: userA }),
      GrammarExercise.deleteMany({ grammarTopicId: topicA._id, userId: userA }),
      GrammarAttempt.deleteMany({ grammarTopicId: topicA._id, userId: userA }),
    ]);

    const remainingEx = await GrammarExercise.countDocuments({
      grammarTopicId: topicA._id,
    });
    const remainingAttempts = await GrammarAttempt.countDocuments({
      grammarTopicId: topicA._id,
    });
    const remainingTopic = await GrammarTopic.findById(topicA._id);

    assert.equal(remainingTopic, null);
    assert.equal(remainingEx, 0);
    assert.equal(remainingAttempts, 0);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});

// 5. Phase 6 Regression: Wrong-Answer Reinsertion Identity & Data Consistency
test("regression: wrong-answer reinsertion strictly preserves GrammarExercise identity, correct answer, and explanation", async () => {
  const mongo = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongo.getUri("test_grammar_regression"));
    await Promise.all([
      GrammarTopic.createIndexes(),
      GrammarExercise.createIndexes(),
      GrammarAttempt.createIndexes(),
      StudySession.createIndexes(),
    ]);

    const userA = new Types.ObjectId();

    const { startGrammarSession, getGrammarSession, submitGrammarAnswer } =
      await import("../src/services/grammar-learning");

    // Create topic
    const topic = await GrammarTopic.create({
      userId: userA,
      title: "Modal Verbs — Ability",
      normalizedTitle: normalizeGrammarTitle("Modal Verbs — Ability"),
      category: "MODAL_VERBS",
      description: "Can, could, be able to",
      content: "Can and could usage rules.",
      status: "NEW",
    });

    // Create 4 exercises
    // Exercise X (Question 0): "My little sister _____ read when she was only four."
    const ex1 = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topic._id,
      type: "MULTIPLE_CHOICE",
      question: "My little sister _____ read when she was only four.",
      options: ["can", "could", "will be able to", "has been able to"],
      correctAnswer: "could",
      acceptedAnswers: ["could"],
      explanation: "'Could' is used for general past ability.",
      order: 0,
      attemptCount: 1,
      lastIsCorrect: false, // Ensure it is sorted first into incorrect queue
    });

    const ex2 = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topic._id,
      type: "MULTIPLE_CHOICE",
      question: "He ran fast and _____ win the marathon.",
      options: ["can", "could", "was able to", "should"],
      correctAnswer: "was able to",
      acceptedAnswers: ["was able to"],
      explanation: "Specific past achievement requires 'was able to'.",
      order: 1,
      attemptCount: 1,
      lastIsCorrect: true,
      lastAttemptAt: new Date(1000),
    });

    const ex3 = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topic._id,
      type: "MULTIPLE_CHOICE",
      question: "She _____ speak three languages fluently.",
      options: ["can", "could", "is able to", "might"],
      correctAnswer: "can",
      acceptedAnswers: ["can"],
      explanation: "General present ability uses 'can'.",
      order: 2,
      attemptCount: 1,
      lastIsCorrect: true,
      lastAttemptAt: new Date(2000),
    });

    // Exercise 4: The one that was previously colliding when wrong-answer reinsertion desynchronized indices!
    const ex4 = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topic._id,
      type: "MULTIPLE_CHOICE",
      question:
        "The fire was huge, but the firefighters _____ rescue everyone.",
      options: ["could", "were able to", "can", "might"],
      correctAnswer: "were able to",
      acceptedAnswers: ["were able to"],
      explanation:
        "For success in a specific difficult situation in the past, use 'was/were able to', not 'could'.",
      order: 3,
      attemptCount: 1,
      lastIsCorrect: true,
      lastAttemptAt: new Date(3000),
    });

    // 1. Start grammar session
    const sessionId = await startGrammarSession(
      "TOPIC",
      topic._id.toString(),
      userA,
    );
    assert.ok(sessionId);

    const initialSession = await getGrammarSession(sessionId, userA);
    assert.equal(initialSession.totalQuestions, 4);

    // 2. Receive exercise X: "My little sister _____ read when she was only four."
    const q0 = initialSession.questions[0];
    assert.equal(q0.exerciseId, ex1._id.toString());
    assert.equal(
      q0.prompt,
      "My little sister _____ read when she was only four.",
    );
    assert.deepEqual(q0.options, [
      "can",
      "could",
      "will be able to",
      "has been able to",
    ]);

    // 3. Verify correctAnswer = "could"
    assert.equal(q0.correctAnswer, "could");
    assert.equal(q0.explanation, "'Could' is used for general past ability.");

    // 4. Submit wrong answer "can"
    const submitResult0 = await submitGrammarAnswer(
      sessionId,
      0,
      "can",
      q0.exerciseId,
      userA,
    );
    assert.equal(submitResult0.isCorrect, false);
    assert.equal(submitResult0.correctAnswer, "could");
    assert.equal(
      submitResult0.explanation,
      "'Could' is used for general past ability.",
    );

    // 5. Exercise X is scheduled for reinsertion
    assert.equal(submitResult0.wasReinserted, true);
    assert.equal(submitResult0.reinsertIndex, 3);
    assert.ok(submitResult0.reinsertedQuestion);
    assert.equal(
      submitResult0.reinsertedQuestion?.exerciseId,
      ex1._id.toString(),
    );
    assert.equal(
      submitResult0.reinsertedQuestion?.prompt,
      "My little sister _____ read when she was only four.",
    );
    assert.equal(submitResult0.reinsertedQuestion?.correctAnswer, "could");
    assert.equal(
      submitResult0.reinsertedQuestion?.explanation,
      "'Could' is used for general past ability.",
    );

    // 6. Answer intervening questions
    // Question 1 (Exercise 2)
    const submitResult1 = await submitGrammarAnswer(
      sessionId,
      1,
      "was able to",
      ex2._id.toString(),
      userA,
    );
    assert.equal(submitResult1.isCorrect, true);
    assert.equal(submitResult1.correctAnswer, "was able to");

    // Question 2 (Exercise 3)
    const submitResult2 = await submitGrammarAnswer(
      sessionId,
      2,
      "can",
      ex3._id.toString(),
      userA,
    );
    assert.equal(submitResult2.isCorrect, true);
    assert.equal(submitResult2.correctAnswer, "can");

    // 7. Exercise X returns at reinsertIndex 3
    const sessionState = await getGrammarSession(sessionId, userA);
    assert.equal(sessionState.questions.length, 5); // 4 original + 1 reinserted
    const q3 = sessionState.questions[3];

    // 8. Verify its exercise ID is unchanged
    assert.equal(q3.exerciseId, ex1._id.toString());

    // 9. Verify question is unchanged
    assert.equal(
      q3.prompt,
      "My little sister _____ read when she was only four.",
    );

    // 10. Verify options are unchanged
    assert.deepEqual(q3.options, [
      "can",
      "could",
      "will be able to",
      "has been able to",
    ]);

    // 11. Verify correctAnswer is still "could"
    assert.equal(q3.correctAnswer, "could");

    // 12. Verify explanation is still the original explanation
    assert.equal(q3.explanation, "'Could' is used for general past ability.");

    // 13. Submit "could"
    const submitRetry = await submitGrammarAnswer(
      sessionId,
      3,
      "could",
      q3.exerciseId,
      userA,
    );

    // 14. It MUST be marked correct
    assert.equal(submitRetry.isCorrect, true);
    assert.equal(submitRetry.correctAnswer, "could");

    // 15. It must not suddenly use another exercise's answer/explanation (specifically ex4's "were able to")
    assert.notEqual(submitRetry.correctAnswer, "were able to");
    assert.notEqual(
      submitRetry.explanation,
      "For success in a specific difficult situation in the past, use 'was/were able to', not 'could'.",
    );
    assert.equal(
      submitRetry.explanation,
      "'Could' is used for general past ability.",
    );

    // Answer final question (ex4 shifted to index 4) to cleanly finish
    const q4 = sessionState.questions[4];
    assert.equal(q4.exerciseId, ex4._id.toString());
    assert.equal(q4.correctAnswer, "were able to");
    const submitResult4 = await submitGrammarAnswer(
      sessionId,
      4,
      "were able to",
      q4.exerciseId,
      userA,
    );
    assert.equal(submitResult4.isCorrect, true);
    assert.equal(submitResult4.isCompleted, true);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});

// 6. Invariant Test: Every queued and retried question resolves all grading data from the same GrammarExercise
test("invariant: every queued and retried grammar question resolves all grading data from the same GrammarExercise", async () => {
  const mongo = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongo.getUri("test_grammar_invariant"));
    await Promise.all([
      GrammarTopic.createIndexes(),
      GrammarExercise.createIndexes(),
      GrammarAttempt.createIndexes(),
      StudySession.createIndexes(),
    ]);

    const userA = new Types.ObjectId();

    const { startGrammarSession, getGrammarSession, submitGrammarAnswer } =
      await import("../src/services/grammar-learning");

    const topic = await GrammarTopic.create({
      userId: userA,
      title: "Mixed Invariant Test Topic",
      normalizedTitle: normalizeGrammarTitle("Mixed Invariant Test Topic"),
      category: "TENSES",
      description: "Multiple exercise types testing queue stability",
      content: "Practice content",
      status: "NEW",
    });

    // Create 5 diverse exercises
    const exMCQ = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topic._id,
      type: "MULTIPLE_CHOICE",
      question: "MCQ prompt: She _____ to school every day.",
      options: ["goes", "go", "going", "gone"],
      correctAnswer: "goes",
      acceptedAnswers: ["goes"],
      explanation: "Third person singular present simple.",
      order: 0,
      attemptCount: 1,
      lastIsCorrect: false,
    });

    const exFill = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topic._id,
      type: "FILL_BLANK",
      question: "Fill blank prompt: They _____ dinner right now.",
      options: [],
      correctAnswer: "are having",
      acceptedAnswers: ["are having", "are eating"],
      explanation: "Present continuous for actions happening now.",
      order: 1,
      attemptCount: 1,
      lastIsCorrect: false,
    });

    const exTF = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topic._id,
      type: "TRUE_FALSE",
      question: "True/False prompt: 'Did you went' is grammatically correct.",
      options: ["True", "False"],
      correctAnswer: "false",
      acceptedAnswers: ["false"],
      explanation: "Did is followed by the base form of the verb.",
      order: 2,
      attemptCount: 1,
      lastIsCorrect: false,
    });

    const exSent = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topic._id,
      type: "SENTENCE_CORRECTION",
      question: "Sentence correction prompt: He do not like coffee.",
      options: [],
      correctAnswer: "He does not like coffee.",
      acceptedAnswers: ["He does not like coffee.", "He doesn't like coffee."],
      explanation: "Third person singular requires does not / doesn't.",
      order: 3,
      attemptCount: 1,
      lastIsCorrect: false,
    });

    const exInput = await GrammarExercise.create({
      userId: userA,
      grammarTopicId: topic._id,
      type: "TEXT_INPUT",
      question: "Text input prompt: Change to past simple: 'She goes home.'",
      options: [],
      correctAnswer: "She went home.",
      acceptedAnswers: ["She went home.", "she went home"],
      explanation: "Past simple of 'go' is 'went'.",
      order: 4,
      attemptCount: 1,
      lastIsCorrect: false,
    });

    const exerciseMap = new Map<string, typeof exMCQ>([
      [exMCQ._id.toString(), exMCQ],
      [exFill._id.toString(), exFill],
      [exTF._id.toString(), exTF],
      [exSent._id.toString(), exSent],
      [exInput._id.toString(), exInput],
    ]);

    const sessionId = await startGrammarSession(
      "TOPIC",
      topic._id.toString(),
      userA,
    );
    const sessionDTO = await getGrammarSession(sessionId, userA);

    // Invariant Check 1: Every question returned by getGrammarSession matches its GrammarExercise 100%
    for (const q of sessionDTO.questions) {
      const canonical = exerciseMap.get(q.exerciseId);
      assert.ok(canonical, `Exercise with id ${q.exerciseId} must exist`);
      assert.equal(q.prompt, canonical.question);
      assert.equal(q.exerciseType, canonical.type);
      assert.equal(q.correctAnswer, canonical.correctAnswer);
      assert.deepEqual(q.options, canonical.options);
      assert.deepEqual(q.acceptedAnswers, canonical.acceptedAnswers);
      assert.equal(q.explanation, canonical.explanation);
    }

    // Invariant Check 2: Index drift tolerance
    // Even if client sends an erroneous or shifted questionIndex,
    // specifying exerciseId forces the server to evaluate against the matching item & exercise
    const firstQ = sessionDTO.questions[0];
    const wrongIndex = 99; // Intentionally erroneous index
    const resSafeIndex = await submitGrammarAnswer(
      sessionId,
      wrongIndex,
      "wrong answer",
      firstQ.exerciseId,
      userA,
    );
    const canonical0 = exerciseMap.get(firstQ.exerciseId)!;
    assert.equal(resSafeIndex.isCorrect, false);
    assert.equal(resSafeIndex.correctAnswer, canonical0.correctAnswer);
    assert.equal(resSafeIndex.explanation, canonical0.explanation);
    assert.equal(resSafeIndex.wasReinserted, true);

    // Invariant Check 3: Check database attempt persistence
    const attempt = await GrammarAttempt.findOne({
      studySessionId: sessionId,
      grammarExerciseId: canonical0._id,
    });
    assert.ok(attempt);
    assert.equal(attempt.prompt, canonical0.question);
    assert.equal(attempt.exerciseType, canonical0.type);
    assert.equal(attempt.correctAnswer, canonical0.correctAnswer);

    // Invariant Check 4: Check reinserted item references identical exercise
    const updatedSession = await StudySession.findById(sessionId);
    assert.ok(updatedSession);
    const reinsertedItem = updatedSession.items[resSafeIndex.reinsertIndex!];
    assert.ok(reinsertedItem);
    assert.equal(
      reinsertedItem.grammarExerciseId?.toString(),
      canonical0._id.toString(),
    );
    assert.equal(reinsertedItem.exerciseType, canonical0.type);
    assert.equal(reinsertedItem.retryCount, 1);

    // Invariant Check 5: Answer the reinserted question and verify evaluation matches canonical0
    // Answer intervening items first
    let currentSessionDTO = await getGrammarSession(sessionId, userA);
    while (true) {
      const nextUnanswered = currentSessionDTO.questions.find(
        (q) => !q.isAnswered,
      );
      if (!nextUnanswered) break;
      const canonicalEx = exerciseMap.get(nextUnanswered.exerciseId)!;
      const submitRes = await submitGrammarAnswer(
        sessionId,
        nextUnanswered.index,
        canonicalEx.correctAnswer,
        nextUnanswered.exerciseId,
        userA,
      );
      assert.equal(submitRes.isCorrect, true);
      assert.equal(submitRes.correctAnswer, canonicalEx.correctAnswer);
      assert.equal(submitRes.explanation, canonicalEx.explanation);
      currentSessionDTO = await getGrammarSession(sessionId, userA);
    }

    assert.equal(currentSessionDTO.isCompleted, true);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});
