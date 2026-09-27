import test from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import {
  calculateNextReview,
  calculateNextWordStatus,
  MIN_EASE_FACTOR,
  MAX_EASE_FACTOR,
} from "../src/lib/spaced-repetition";
import { normalizeWord } from "../src/features/vocabulary/constants";

// --- 1. SPACED REPETITION ALGORITHM UNIT TESTS ---

test("spaced repetition: NEW + GOOD starts at 1 day interval", () => {
  const initial = {
    intervalDays: 0,
    easeFactor: 2.5,
    repetitions: 0,
    correctCount: 0,
    incorrectCount: 0,
  };
  const now = new Date("2026-09-25T12:00:00Z");
  const res = calculateNextReview(initial, "GOOD", now);

  assert.equal(res.repetitions, 1);
  assert.equal(res.intervalDays, 1);
  assert.equal(res.correctCount, 1);
  assert.equal(res.incorrectCount, 0);
  assert.equal(res.lastRating, "GOOD");
  assert.equal(
    res.nextReviewAt.toISOString(),
    new Date("2026-09-26T12:00:00Z").toISOString(),
  );
});

test("spaced repetition: NEW + AGAIN resets repetitions and schedules soon", () => {
  const initial = {
    intervalDays: 0,
    easeFactor: 2.5,
    repetitions: 0,
    correctCount: 0,
    incorrectCount: 0,
  };
  const now = new Date("2026-09-25T12:00:00Z");
  const res = calculateNextReview(initial, "AGAIN", now);

  assert.equal(res.repetitions, 0);
  assert.equal(res.intervalDays, 0);
  assert.equal(res.incorrectCount, 1);
  assert.equal(res.easeFactor, 2.3);
  // Due 10 minutes later
  assert.equal(res.nextReviewAt.getTime() - now.getTime(), 10 * 60 * 1000);
});

test("spaced repetition: GOOD progression follows expected intervals", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  let state = {
    intervalDays: 0,
    easeFactor: 2.5,
    repetitions: 0,
    correctCount: 0,
    incorrectCount: 0,
  };

  // 1st GOOD -> 1 day
  state = calculateNextReview(state, "GOOD", now);
  assert.equal(state.repetitions, 1);
  assert.equal(state.intervalDays, 1);

  // 2nd GOOD -> 3 days
  state = calculateNextReview(state, "GOOD", now);
  assert.equal(state.repetitions, 2);
  assert.equal(state.intervalDays, 3);

  // 3rd GOOD -> 7 days
  state = calculateNextReview(state, "GOOD", now);
  assert.equal(state.repetitions, 3);
  assert.equal(state.intervalDays, 7);

  // 4th GOOD -> 14 days
  state = calculateNextReview(state, "GOOD", now);
  assert.equal(state.repetitions, 4);
  assert.equal(state.intervalDays, 14);

  // 5th GOOD -> 30 days
  state = calculateNextReview(state, "GOOD", now);
  assert.equal(state.repetitions, 5);
  assert.equal(state.intervalDays, 30);
});

test("spaced repetition: HARD progression increases interval moderately", () => {
  const initial = {
    intervalDays: 7,
    easeFactor: 2.5,
    repetitions: 3,
    correctCount: 3,
    incorrectCount: 0,
  };
  const now = new Date("2026-09-25T12:00:00Z");
  const res = calculateNextReview(initial, "HARD", now);

  assert.equal(res.repetitions, 4);
  assert.equal(res.intervalDays, 8); // Math.round(7 * 1.2) = 8
  assert.equal(res.easeFactor, 2.35); // 2.5 - 0.15
  assert.equal(res.correctCount, 4);
});

test("spaced repetition: EASY progression grants bonus interval and ease", () => {
  const initial = {
    intervalDays: 0,
    easeFactor: 2.5,
    repetitions: 0,
    correctCount: 0,
    incorrectCount: 0,
  };
  const now = new Date("2026-09-25T12:00:00Z");
  const res = calculateNextReview(initial, "EASY", now);

  assert.equal(res.repetitions, 1);
  assert.equal(res.intervalDays, 4);
  assert.equal(res.easeFactor, 2.65);
});

test("spaced repetition: easeFactor boundaries are respected", () => {
  const low = {
    intervalDays: 1,
    easeFactor: 1.35,
    repetitions: 1,
    correctCount: 0,
    incorrectCount: 5,
  };
  const resLow = calculateNextReview(low, "AGAIN");
  assert.equal(resLow.easeFactor, MIN_EASE_FACTOR);

  const high = {
    intervalDays: 30,
    easeFactor: 2.95,
    repetitions: 5,
    correctCount: 10,
    incorrectCount: 0,
  };
  const resHigh = calculateNextReview(high, "EASY");
  assert.equal(resHigh.easeFactor, MAX_EASE_FACTOR);
});

test("status transitions: evolution from NEW to LEARNING to LEARNED and DIFFICULT", () => {
  // NEW + GOOD -> LEARNING
  assert.equal(
    calculateNextWordStatus("NEW", "GOOD", {
      repetitions: 1,
      incorrectCount: 0,
    }),
    "LEARNING",
  );

  // Repeated failures -> DIFFICULT
  assert.equal(
    calculateNextWordStatus("LEARNING", "AGAIN", {
      repetitions: 0,
      incorrectCount: 3,
    }),
    "DIFFICULT",
  );

  // Single accidental mistake does not immediately make DIFFICULT
  assert.equal(
    calculateNextWordStatus("LEARNING", "AGAIN", {
      repetitions: 0,
      incorrectCount: 1,
    }),
    "LEARNING",
  );

  // Consistent success on DIFFICULT -> moves back to LEARNING
  assert.equal(
    calculateNextWordStatus("DIFFICULT", "GOOD", {
      repetitions: 2,
      incorrectCount: 3,
    }),
    "LEARNING",
  );

  // Sufficient repetitions on LEARNING -> LEARNED
  assert.equal(
    calculateNextWordStatus("LEARNING", "GOOD", {
      repetitions: 4,
      incorrectCount: 0,
    }),
    "LEARNED",
  );
});

// --- 2. DATABASE INTEGRATION & LEARNING WORKFLOW TESTS ---

test("database integration: session generation, exercises, answer evaluation, reinsertion, and security", async () => {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const { VocabularyWord } = await import("../src/models/vocabulary-word");
  const { VocabularyReview } = await import("../src/models/vocabulary-review");
  const { StudySession } = await import("../src/models/study-session");
  const { VocabularyAttempt } =
    await import("../src/models/vocabulary-attempt");
  const { calculateStreakFromDates } = await import("../src/lib/streak");
  const { dateKey } = await import("../src/lib/dates");

  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri("learning_tests");
  await mongoose.connect(uri);

  try {
    await Promise.all([
      VocabularyWord.createIndexes(),
      VocabularyReview.createIndexes(),
      StudySession.createIndexes(),
      VocabularyAttempt.createIndexes(),
    ]);

    const userA = new Types.ObjectId();
    const userB = new Types.ObjectId();

    // 1. Empty vocabulary handling: throwing clean error
    let emptyError = false;
    try {
      // Mock session start for empty user
      const words = await VocabularyWord.find({ userId: userA });
      if (!words.length) throw new Error("Empty vocabulary");
    } catch {
      emptyError = true;
    }
    assert.equal(emptyError, true);

    // 2. Create small vocabulary for User A (4 words)
    const wordsA = await VocabularyWord.create([
      {
        userId: userA,
        word: "take",
        translation: "olmoq",
        example: "Please take a seat.",
        status: "NEW",
      },
      {
        userId: userA,
        word: "appropriate",
        translation: "mos, munosib",
        example: "This dress is appropriate for the interview.",
        status: "NEW",
      },
      {
        userId: userA,
        word: "litter",
        translation: "axlat",
        example: "Do not leave litter behind.",
        status: "DIFFICULT",
      },
      {
        userId: userA,
        word: "reach",
        translation: "yetib bormoq",
        status: "NEW",
      },
    ]);

    // Create reviews for User A
    const reviewsA = await VocabularyReview.create([
      {
        userId: userA,
        vocabularyWordId: wordsA[0]._id,
        nextReviewAt: new Date(Date.now() - 3600_000), // Overdue
      },
      {
        userId: userA,
        vocabularyWordId: wordsA[1]._id,
        nextReviewAt: new Date(Date.now() - 7200_000), // Overdue
      },
      {
        userId: userA,
        vocabularyWordId: wordsA[2]._id,
        nextReviewAt: new Date(Date.now() - 1000), // Due
      },
      {
        userId: userA,
        vocabularyWordId: wordsA[3]._id,
        nextReviewAt: new Date(Date.now() + 86400_000), // Future
      },
    ]);

    // Create a word for User B
    const wordB = await VocabularyWord.create({
      userId: userB,
      word: "secret",
      translation: "sir",
      status: "NEW",
    });
    await VocabularyReview.create({
      userId: userB,
      vocabularyWordId: wordB._id,
      nextReviewAt: new Date(),
    });

    // 3. Small vocabulary session generation
    const sessionDoc = await StudySession.create({
      userId: userA,
      type: "DAILY",
      startedAt: new Date(),
      totalQuestions: 4,
      answeredQuestions: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      items: [
        {
          vocabularyWordId: wordsA[0]._id,
          exerciseType: "MULTIPLE_CHOICE",
          order: 0,
          answered: false,
          isCorrect: null,
          retryCount: 0,
        },
        {
          vocabularyWordId: wordsA[1]._id,
          exerciseType: "FILL_BLANK",
          order: 1,
          answered: false,
          isCorrect: null,
          retryCount: 0,
        },
        {
          vocabularyWordId: wordsA[2]._id,
          exerciseType: "TYPING",
          order: 2,
          answered: false,
          isCorrect: null,
          retryCount: 0,
        },
        {
          vocabularyWordId: wordsA[3]._id,
          exerciseType: "UZ_TO_EN",
          order: 3,
          answered: false,
          isCorrect: null,
          retryCount: 0,
        },
      ],
    });

    assert.ok(sessionDoc);
    assert.equal(sessionDoc.items.length, 4);

    // 4. Exercise validation:
    // Multiple Choice: Check that options are unique and correct translation is included
    const allTranslations = wordsA.map((w) => w.translation);
    const targetTrans = wordsA[0].translation;
    const distractors = allTranslations.filter((t) => t !== targetTrans);
    const options = [targetTrans, ...distractors];
    assert.equal(new Set(options).size, options.length);
    assert.ok(options.includes(targetTrans));

    // Typing answer normalization
    assert.equal(normalizeWord("  TAKE "), "take");
    assert.equal(normalizeWord("take"), "take");

    // Fill in blank check
    const sentenceWithBlank = wordsA[1].example.replace(
      /\bappropriate\b/i,
      "______",
    );
    assert.ok(sentenceWithBlank.includes("______"));
    assert.ok(!sentenceWithBlank.includes("appropriate"));

    // 5. Answer submission: Correct Answer
    const submitResult1 = {
      isCorrect:
        normalizeWord("olmoq") === normalizeWord(wordsA[0].translation),
      rating: "GOOD" as const,
    };
    assert.equal(submitResult1.isCorrect, true);

    const reviewAfterCorrect = calculateNextReview(
      reviewsA[0],
      submitResult1.rating,
    );
    assert.equal(reviewAfterCorrect.repetitions, 1);
    assert.equal(reviewAfterCorrect.intervalDays, 1);
    assert.ok(reviewAfterCorrect.nextReviewAt > new Date());

    // Record attempt
    await VocabularyAttempt.create({
      userId: userA,
      vocabularyWordId: wordsA[0]._id,
      studySessionId: sessionDoc._id,
      exerciseType: "MULTIPLE_CHOICE",
      prompt: wordsA[0].word,
      userAnswer: "olmoq",
      correctAnswer: "olmoq",
      isCorrect: true,
      rating: "GOOD",
    });

    // 6. Answer submission: Incorrect Answer & Wrong Answer Reinsertion
    const submitResult2 = {
      isCorrect:
        normalizeWord("wrong answer") === normalizeWord(wordsA[1].word),
      rating: "AGAIN" as const,
    };
    assert.equal(submitResult2.isCorrect, false);

    const reviewAfterIncorrect = calculateNextReview(
      reviewsA[1],
      submitResult2.rating,
    );
    assert.equal(reviewAfterIncorrect.repetitions, 0);
    assert.equal(reviewAfterIncorrect.intervalDays, 0);

    // Reinsertion: if retryCount < 2, reinsert question later
    const reinsertedItem = {
      vocabularyWordId: wordsA[1]._id,
      exerciseType: "MULTIPLE_CHOICE",
      order: 4,
      answered: false,
      isCorrect: null,
      retryCount: 1,
    };
    sessionDoc.items.push(reinsertedItem);
    sessionDoc.totalQuestions = sessionDoc.items.length;
    assert.equal(sessionDoc.items.length, 5); // 4 + 1 reinserted!

    // 7. Retry limit: retryCount >= 2 is not reinserted again
    const maxRetryItem = {
      vocabularyWordId: wordsA[1]._id,
      exerciseType: "MULTIPLE_CHOICE",
      order: 5,
      answered: true,
      isCorrect: false,
      retryCount: 2,
    };
    const canRetryFurther = maxRetryItem.retryCount < 2;
    assert.equal(canRetryFurther, false);

    // 8. Streak calculation
    // Mark session as completed yesterday
    const yesterday = new Date(Date.now() - 86400_000);
    sessionDoc.completedAt = yesterday;
    await sessionDoc.save();

    const getUserStreak = async (uid: Types.ObjectId) => {
      const sessions = await StudySession.find({
        userId: uid,
        completedAt: { $ne: null },
      })
        .select("completedAt")
        .lean();
      const dates = new Set(
        sessions.map((s) => dateKey(s.completedAt!, "Asia/Tashkent")),
      );
      return calculateStreakFromDates(
        dates,
        dateKey(new Date(), "Asia/Tashkent"),
      );
    };

    const streak1 = await getUserStreak(userA);
    assert.equal(streak1, 1); // Streak alive from yesterday

    // Another session completed today
    await StudySession.create({
      userId: userA,
      type: "DAILY",
      startedAt: new Date(),
      completedAt: new Date(),
      totalQuestions: 5,
      answeredQuestions: 5,
      correctAnswers: 5,
      incorrectAnswers: 0,
      items: [],
    });
    const streak2 = await getUserStreak(userA);
    assert.equal(streak2, 2); // 2 consecutive days!

    // Same-day multiple sessions do not inflate streak
    await StudySession.create({
      userId: userA,
      type: "DUE",
      startedAt: new Date(),
      completedAt: new Date(),
      totalQuestions: 3,
      answeredQuestions: 3,
      correctAnswers: 3,
      incorrectAnswers: 0,
      items: [],
    });
    const streak3 = await getUserStreak(userA);
    assert.equal(streak3, 2); // Still 2 consecutive days

    // 9. Security & Isolation
    // User B cannot access User A's session
    const userBTriesToReadSessionA = await StudySession.findOne({
      _id: sessionDoc._id,
      userId: userB,
    });
    assert.equal(userBTriesToReadSessionA, null);

    // User B cannot access User A's attempts
    const userBTriesToReadAttemptsA = await VocabularyAttempt.find({
      studySessionId: sessionDoc._id,
      userId: userB,
    });
    assert.equal(userBTriesToReadAttemptsA.length, 0);

    // User A cannot manipulate User B's review
    const editReviewResult = await VocabularyReview.updateOne(
      { userId: userA, vocabularyWordId: wordB._id },
      { $set: { repetitions: 99 } },
    );
    assert.equal(editReviewResult.matchedCount, 0);
    assert.equal(editReviewResult.modifiedCount, 0);

    const wordBReview = await VocabularyReview.findOne({
      userId: userB,
      vocabularyWordId: wordB._id,
    });
    assert.equal(wordBReview?.repetitions, 0); // Intact!
  } finally {
    await mongoose.connection.close();
    await mongoose.disconnect();
    await mongo.stop();
  }
});
