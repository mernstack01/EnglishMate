import test from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { normalizeSynonymTerm } from "../src/features/synonyms/constants";
import {
  synonymGroupInputSchema,
  parseSynonymImport,
} from "../src/validations/synonyms";
import { SynonymGroup } from "../src/models/synonym-group";
import { SynonymReview } from "../src/models/synonym-review";
import { SynonymAttempt } from "../src/models/synonym-attempt";
import { StudySession } from "../src/models/study-session";
import {
  calculateNextReview,
  calculateNextWordStatus,
} from "../src/lib/spaced-repetition";
import { calculateStreakFromDates } from "../src/lib/streak";
import { dateKey } from "../src/lib/dates";

// 1. Term & Synonym Normalization
test("synonym term and word normalization handles whitespace, casing, and Unicode", () => {
  assert.equal(normalizeSynonymTerm(" Want To "), "want to");
  assert.equal(normalizeSynonymTerm("WANT   TO"), "want to");
  assert.equal(normalizeSynonymTerm("ＰＲＯＢＬＥＭ"), "problem");
  assert.equal(normalizeSynonymTerm("  Be   Willing   To  "), "be willing to");
});

// 2. Validation Bounds & Disallowing Duplicate Synonyms Inside Group
test("synonymGroupInputSchema validates bounds and rejects duplicate synonyms within the same group", () => {
  // Valid group
  const valid = synonymGroupInputSchema.safeParse({
    term: "want to",
    meaning: "xohlamoq",
    synonyms: [
      { word: "would like to" },
      { word: "wish to" },
      { word: "intend to" },
    ],
  });
  assert.ok(valid.success);

  // Rejects empty synonym array
  const emptySynonyms = synonymGroupInputSchema.safeParse({
    term: "want to",
    synonyms: [],
  });
  assert.equal(emptySynonyms.success, false);

  // Rejects empty term
  const emptyTerm = synonymGroupInputSchema.safeParse({
    term: "   ",
    synonyms: [{ word: "wish to" }],
  });
  assert.equal(emptyTerm.success, false);

  // Rejects duplicate synonyms within the same group
  const dupSynonyms = synonymGroupInputSchema.safeParse({
    term: "want to",
    synonyms: [
      { word: "wish to" },
      { word: "Wish   To" }, // Case & whitespace insensitive duplicate
    ],
  });
  assert.equal(dupSynonyms.success, false);

  // Rejects synonym identical to main term
  const termAsSynonym = synonymGroupInputSchema.safeParse({
    term: "want to",
    synonyms: [{ word: "want to" }],
  });
  assert.equal(termAsSynonym.success, false);
});

// 3. JSON Import Parsing & Validation
test("parseSynonymImport handles valid, duplicate, and invalid JSON formats", () => {
  const jsonContent = JSON.stringify([
    {
      term: "want to",
      meaning: "xohlamoq",
      synonyms: ["would like to", "wish to"],
    },
    {
      term: "problem",
      meaning: "muammo",
      synonyms: ["issue", "difficulty"],
    },
    {
      term: "want to", // Duplicate term in file
      synonyms: ["intend to"],
    },
    {
      term: "invalid group",
      synonyms: [], // Invalid: empty synonyms
    },
  ]);

  const rows = parseSynonymImport(jsonContent);
  assert.equal(rows.length, 4);

  assert.equal(rows[0].kind, "ready");
  assert.equal(rows[0].term, "want to");
  assert.equal(rows[0].synonyms.length, 2);

  assert.equal(rows[1].kind, "ready");
  assert.equal(rows[1].term, "problem");

  assert.equal(rows[2].kind, "duplicate");
  assert.ok(rows[2].issues.includes("Repeated"));

  assert.equal(rows[3].kind, "invalid");
});

// 4. Database Integration: Full CRUD, Security/Ownership, Reviews, Learning, Attempts & Streak
test("database integration: full synonym lifecycle, user isolation, reviews, exercise validation, and streak", async () => {
  const mongo = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongo.getUri("test_synonyms"));
    await Promise.all([
      SynonymGroup.createIndexes(),
      SynonymReview.createIndexes(),
      SynonymAttempt.createIndexes(),
      StudySession.createIndexes(),
    ]);

    const userA = new Types.ObjectId();
    const userB = new Types.ObjectId();

    // 1. Create Synonym Group for User A
    const groupA1 = await SynonymGroup.create({
      userId: userA,
      term: "want to",
      meaning: "xohlamoq",
      notes: "Informal to formal expressions",
      status: "NEW",
      source: "MANUAL",
      synonyms: [
        { word: "would like to", example: "I would like to help." },
        { word: "wish to", example: "I wish to see him." },
        { word: "intend to", example: "We intend to leave early." },
        { word: "be willing to", example: "Are you willing to join?" },
      ],
      review: {
        nextReviewAt: new Date(),
        lastReviewedAt: null,
        intervalDays: 0,
        easeFactor: 2.5,
        repetitions: 0,
        correctCount: 0,
        incorrectCount: 0,
      },
    });

    assert.ok(groupA1._id);
    assert.equal(groupA1.normalizedTerm, "want to");
    assert.equal(groupA1.synonyms.length, 4);
    assert.equal(groupA1.synonyms[0].normalizedWord, "would like to");

    // 2. Duplicate normalized term for same user must be rejected
    await assert.rejects(
      async () => {
        await SynonymGroup.create({
          userId: userA,
          term: "  WANT   TO  ",
          meaning: "duplicate",
          synonyms: [{ word: "wish to" }],
        });
      },
      (err: unknown) =>
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: number }).code === 11000,
    );

    // 3. Different user B can store the exact same term
    const groupB1 = await SynonymGroup.create({
      userId: userB,
      term: "want to",
      meaning: "user B meaning",
      synonyms: [{ word: "would like to" }],
    });
    assert.ok(groupB1._id);

    // 4. Security / Ownership Isolation: User A cannot read, edit, or delete User B's group
    const readAttempt = await SynonymGroup.findOne({
      _id: groupB1._id,
      userId: userA,
    });
    assert.equal(readAttempt, null);

    const updateAttempt = await SynonymGroup.updateOne(
      { _id: groupB1._id, userId: userA },
      { $set: { meaning: "hacked" } },
    );
    assert.equal(updateAttempt.matchedCount, 0);

    const deleteAttempt = await SynonymGroup.deleteOne({
      _id: groupB1._id,
      userId: userA,
    });
    assert.equal(deleteAttempt.deletedCount, 0);

    // 5. Add second and third group for User A for distractor and match exercises
    const groupA2 = await SynonymGroup.create({
      userId: userA,
      term: "problem",
      meaning: "muammo",
      status: "LEARNING",
      synonyms: [
        { word: "issue" },
        { word: "difficulty" },
        { word: "obstacle" },
        { word: "challenge" },
      ],
      review: {
        nextReviewAt: new Date(),
        lastReviewedAt: null,
        intervalDays: 1,
        easeFactor: 2.5,
        repetitions: 1,
        correctCount: 1,
        incorrectCount: 0,
      },
    });

    const groupA3 = await SynonymGroup.create({
      userId: userA,
      term: "mostly",
      meaning: "asosan",
      status: "NEW",
      synonyms: [
        { word: "mainly" },
        { word: "generally" },
        { word: "primarily" },
        { word: "largely" },
      ],
      review: {
        nextReviewAt: new Date(),
        lastReviewedAt: null,
        intervalDays: 0,
        easeFactor: 2.5,
        repetitions: 0,
        correctCount: 0,
        incorrectCount: 0,
      },
    });

    // 6. Test Spaced Repetition Scheduling on Synonym Groups
    const initialSchedule = {
      intervalDays: 0,
      easeFactor: 2.5,
      repetitions: 0,
      correctCount: 0,
      incorrectCount: 0,
    };
    const scheduledGood = calculateNextReview(initialSchedule, "GOOD");
    assert.equal(scheduledGood.intervalDays, 1);
    assert.equal(scheduledGood.repetitions, 1);
    assert.equal(scheduledGood.correctCount, 1);

    const scheduledAgain = calculateNextReview(scheduledGood, "AGAIN");
    assert.equal(scheduledAgain.intervalDays, 0);
    assert.equal(scheduledAgain.repetitions, 0);
    assert.equal(scheduledAgain.incorrectCount, 1);

    // 7. Status Transitions
    const statusFromNew = calculateNextWordStatus("NEW", "GOOD", {
      repetitions: 1,
      incorrectCount: 0,
    });
    assert.equal(statusFromNew, "LEARNING");

    const statusToDifficult = calculateNextWordStatus("LEARNING", "AGAIN", {
      repetitions: 0,
      incorrectCount: 3,
    });
    assert.equal(statusToDifficult, "DIFFICULT");

    // 8. Study Session with Synonym Items
    const studySession = await StudySession.create({
      userId: userA,
      module: "SYNONYMS",
      type: "DAILY",
      totalQuestions: 4,
      answeredQuestions: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      items: [
        {
          synonymGroupId: groupA1._id,
          exerciseType: "RECOGNITION",
          order: 0,
          answered: false,
          isCorrect: null,
          retryCount: 0,
        },
        {
          synonymGroupId: groupA1._id,
          exerciseType: "REVERSE_RECOGNITION",
          order: 1,
          answered: false,
          isCorrect: null,
          retryCount: 0,
        },
        {
          synonymGroupId: groupA2._id,
          exerciseType: "TYPING",
          order: 2,
          answered: false,
          isCorrect: null,
          retryCount: 0,
        },
        {
          synonymGroupId: groupA1._id,
          exerciseType: "MATCH",
          order: 3,
          answered: false,
          isCorrect: null,
          retryCount: 0,
        },
      ],
    });

    assert.equal(studySession.module, "SYNONYMS");
    assert.equal(studySession.items.length, 4);

    // 9. Answer Evaluation:
    // a. TYPING: accepts ANY synonym stored in groupA2 ("issue", "difficulty", "obstacle", "challenge")
    const validTypingAnswers = [
      "difficulty",
      "  ISSUE ",
      "obstacle",
      "Challenge",
    ];
    const groupA2SynNorms = new Set(
      groupA2.synonyms.map((s) => normalizeSynonymTerm(s.word)),
    );

    for (const ans of validTypingAnswers) {
      assert.ok(groupA2SynNorms.has(normalizeSynonymTerm(ans)));
    }

    // typing rejects unrelated word
    assert.equal(
      groupA2SynNorms.has(normalizeSynonymTerm("unrelated_word")),
      false,
    );

    // b. Record SynonymAttempt
    const attempt = await SynonymAttempt.create({
      userId: userA,
      synonymGroupId: groupA2._id,
      studySessionId: studySession._id,
      exerciseType: "TYPING",
      prompt: "problem",
      userAnswer: "difficulty",
      correctAnswer: "issue, difficulty, obstacle, challenge",
      isCorrect: true,
      rating: "GOOD",
    });

    assert.ok(attempt._id);
    assert.equal(attempt.isCorrect, true);

    // User B cannot see User A's attempt
    const foreignAttempt = await SynonymAttempt.findOne({
      _id: attempt._id,
      userId: userB,
    });
    assert.equal(foreignAttempt, null);

    // 10. Complete session and verify streak integration
    studySession.answeredQuestions = 4;
    studySession.correctAnswers = 4;
    studySession.completedAt = new Date();
    await studySession.save();

    // Verify streak calculation includes this synonym session
    const today = dateKey(new Date(), "Asia/Tashkent");
    const datesWithCompletedSessions = new Set([today]);
    const streak = calculateStreakFromDates(datesWithCompletedSessions, today);
    assert.equal(streak, 1);

    // 11. Calendar Aggregation for Synonyms
    const calendarCounts = await SynonymGroup.aggregate([
      { $match: { userId: userA } },
      {
        $group: {
          _id: {
            $dateToString: {
              date: "$createdAt",
              format: "%Y-%m-%d",
              timezone: "Asia/Tashkent",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);
    const countsMap = Object.fromEntries(
      calendarCounts.map((c) => [c._id, c.count]),
    );
    assert.equal(countsMap[today], 3);

    // 12. Delete group cleans associated SynonymReview records
    await SynonymReview.create({
      userId: userA,
      synonymGroupId: groupA3._id,
      nextReviewAt: new Date(),
    });

    await Promise.all([
      SynonymGroup.deleteOne({ userId: userA, _id: groupA3._id }),
      SynonymReview.deleteMany({ userId: userA, synonymGroupId: groupA3._id }),
    ]);

    assert.equal(await SynonymGroup.findById(groupA3._id), null);
    assert.equal(
      await SynonymReview.countDocuments({
        userId: userA,
        synonymGroupId: groupA3._id,
      }),
      0,
    );
  } finally {
    await mongoose.connection.close();
    await mongoose.disconnect();
    await mongo.stop();
  }
});
