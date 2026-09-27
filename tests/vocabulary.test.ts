import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWord } from "../src/features/vocabulary/constants";
import {
  wordInputSchema,
  editWordSchema,
  vocabularyQuerySchema,
  parseImport,
} from "../src/validations/vocabulary";
import {
  dateKey,
  dayRange,
  isDateKey,
  monthKeys,
  dayLabel,
} from "../src/lib/dates";
import { VocabularyWord } from "../src/models/vocabulary-word";
import mongoose, { Types } from "mongoose";
test("normalization handles case, whitespace, phrases and Unicode width", () => {
  assert.equal(normalizeWord(" Appropriate "), "appropriate");
  assert.equal(normalizeWord("OUT   of"), "out of");
  assert.equal(normalizeWord("ＡＰＰＲＯＰＲＩＡＴＥ"), "appropriate");
});
test("word input validates bounds, strips ownership, review and source", () => {
  const parsed = wordInputSchema.parse({
    word: " take ",
    translation: " olmoq ",
    userId: "foreign",
    source: "AI",
    status: "LEARNED",
    normalizedWord: "fake",
    review: { nextReviewAt: "2100-01-01" },
  });
  assert.equal(parsed.word, "take");
  assert.equal(parsed.translation, "olmoq");
  for (const key of ["userId", "source", "status", "normalizedWord", "review"])
    assert.equal(key in parsed, false);
  assert.equal(
    wordInputSchema.safeParse({ word: " ", translation: "x" }).success,
    false,
  );
  assert.equal(
    wordInputSchema.safeParse({ word: { $ne: null }, translation: "x" })
      .success,
    false,
  );
  assert.equal(
    wordInputSchema.safeParse({ word: "x".repeat(121), translation: "x" })
      .success,
    false,
  );
  assert.equal(
    editWordSchema.safeParse({
      word: "x",
      translation: "y",
      status: "NEW",
      difficulty: 2.5,
    }).success,
    false,
  );
  assert.equal(vocabularyQuerySchema.safeParse({ page: -1 }).success, false);
});
test("import classifies invalid and normalized in-file duplicates", () => {
  const rows = parseImport(
    JSON.stringify([
      { word: "Appropriate", translation: "mos" },
      { word: " APPROPRIATE ", translation: "other" },
      { word: "missing" },
      null,
      { word: "out of", translation: "dan" },
    ]),
  );
  assert.deepEqual(
    rows.map((row) => row.kind),
    ["ready", "duplicate", "invalid", "invalid", "ready"],
  );
  assert.throws(() => parseImport("not JSON"), /not valid/);
  assert.throws(() => parseImport("{}"), /non-empty JSON array/);
  assert.throws(() => parseImport("[]"), /non-empty JSON array/);
  assert.throws(
    () => parseImport(JSON.stringify(Array(301).fill({}))),
    /300 rows/,
  );
  assert.throws(() => parseImport(" ".repeat(256001)), /256 KB/);
});
test("civil date bounds use application timezone at UTC day edges", () => {
  assert.equal(
    dateKey(new Date("2026-09-25T19:00:00Z"), "Asia/Tashkent"),
    "2026-09-26",
  );
  const range = dayRange("2026-09-26", "Asia/Tashkent");
  assert.equal(range.$gte.toISOString(), "2026-09-25T19:00:00.000Z");
  assert.equal(range.$lt.toISOString(), "2026-09-26T19:00:00.000Z");
  assert.equal(dayLabel("2026-09-25", "2026-09-26"), "Yesterday");
});
test("date bounds support DST days and reject rolled-over dates", () => {
  const spring = dayRange("2026-03-08", "America/New_York");
  const autumn = dayRange("2026-11-01", "America/New_York");
  assert.equal((+spring.$lt - +spring.$gte) / 3600000, 23);
  assert.equal((+autumn.$lt - +autumn.$gte) / 3600000, 25);
  assert.equal(isDateKey("2026-02-30"), false);
  assert.equal(isDateKey("2028-02-29"), true);
  assert.equal(monthKeys("2028-02").days, 29);
});
test("model initializes embedded review and enforces ownership indexes", async () => {
  const word = new VocabularyWord({
    userId: new Types.ObjectId(),
    word: " TEST ",
    translation: "sinov",
  });
  await word.validate();
  assert.equal(word.normalizedWord, "test");
  assert.equal(word.status, "NEW");
  assert.equal(word.difficulty, 0);
  assert.equal(word.review.repetitions, 0);
  assert.equal(word.review.lastReviewedAt, null);
  assert.ok(word.review.nextReviewAt <= new Date());
  assert.ok(
    VocabularyWord.schema
      .indexes()
      .some(
        ([index, options]) =>
          index.userId === 1 && index.normalizedWord === 1 && options.unique,
      ),
  );
});

test("database integration: full vocabulary lifecycle, isolation, calendar, import and cleanup", async () => {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const { VocabularyReview } = await import("../src/models/vocabulary-review");
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri("vocabulary_tests");
  await mongoose.connect(uri);

  try {
    await Promise.all([
      VocabularyWord.createIndexes(),
      VocabularyReview.createIndexes(),
    ]);

    const userA = new Types.ObjectId();
    const userB = new Types.ObjectId();

    // 1. User can create vocabulary
    const wordA = await VocabularyWord.create({
      userId: userA,
      word: " Appropriate ",
      translation: "mos, munosib",
      definition: "suitable for a particular situation",
      example: "This dress is appropriate.",
      status: "NEW",
      source: "MANUAL",
    });
    await VocabularyReview.create({
      userId: userA,
      vocabularyWordId: wordA._id,
      nextReviewAt: wordA.review.nextReviewAt,
    });

    assert.equal(wordA.word, "Appropriate");
    assert.equal(wordA.normalizedWord, "appropriate");
    assert.equal(wordA.translation, "mos, munosib");
    assert.equal(wordA.status, "NEW");
    assert.equal(wordA.source, "MANUAL");
    assert.equal(wordA.difficulty, 0);
    assert.equal(wordA.review.repetitions, 0);
    assert.ok(wordA.review.nextReviewAt <= new Date());

    // 2. User can retrieve their vocabulary
    const retrieved = await VocabularyWord.findOne({
      userId: userA,
      _id: wordA._id,
    }).lean();
    assert.ok(retrieved);
    assert.equal(retrieved.word, "Appropriate");

    // Search retrieval by word or translation
    const searchWord = await VocabularyWord.find({
      userId: userA,
      $or: [
        { word: { $regex: "appropr", $options: "i" } },
        { translation: { $regex: "appropr", $options: "i" } },
      ],
    }).lean();
    assert.equal(searchWord.length, 1);

    const searchTrans = await VocabularyWord.find({
      userId: userA,
      $or: [
        { word: { $regex: "munosib", $options: "i" } },
        { translation: { $regex: "munosib", $options: "i" } },
      ],
    }).lean();
    assert.equal(searchTrans.length, 1);

    // 3. User A cannot retrieve User B word
    const wordB = await VocabularyWord.create({
      userId: userB,
      word: "secret",
      translation: "sir",
      status: "NEW",
      source: "MANUAL",
    });
    await VocabularyReview.create({
      userId: userB,
      vocabularyWordId: wordB._id,
      nextReviewAt: wordB.review.nextReviewAt,
    });

    const userATriesToReadB = await VocabularyWord.findOne({
      userId: userA,
      _id: wordB._id,
    }).lean();
    assert.equal(userATriesToReadB, null);

    // 4. User A cannot edit User B word
    const editResult = await VocabularyWord.updateOne(
      { userId: userA, _id: wordB._id },
      { $set: { translation: "tampered" } },
    );
    assert.equal(editResult.matchedCount, 0);
    assert.equal(editResult.modifiedCount, 0);
    const wordBAfterEditAttempt = await VocabularyWord.findById(
      wordB._id,
    ).lean();
    assert.equal(wordBAfterEditAttempt?.translation, "sir");

    // 5. User A cannot delete User B word
    const deleteResult = await VocabularyWord.deleteOne({
      userId: userA,
      _id: wordB._id,
    });
    assert.equal(deleteResult.deletedCount, 0);
    const wordBAfterDeleteAttempt = await VocabularyWord.findById(
      wordB._id,
    ).lean();
    assert.ok(wordBAfterDeleteAttempt);

    // 6. Duplicate normalized word detection works
    let duplicateRejected = false;
    try {
      await VocabularyWord.create({
        userId: userA,
        word: "APPROPRIATE",
        translation: "duplicate translation",
      });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === 11000
      ) {
        duplicateRejected = true;
      }
    }
    assert.equal(duplicateRejected, true);

    // 7. Different users may store the same normalized word
    const wordBAppropriate = await VocabularyWord.create({
      userId: userB,
      word: "appropriate",
      translation: "bob's translation",
      status: "NEW",
      source: "MANUAL",
    });
    assert.ok(wordBAppropriate);
    assert.equal(wordBAppropriate.normalizedWord, "appropriate");
    assert.equal(wordBAppropriate.translation, "bob's translation");

    // 8. JSON import validation works
    const parsedImport = parseImport(
      JSON.stringify([
        { word: "participate", translation: "qatnashmoq" },
        { word: "invalid entry" }, // missing translation
        { word: "PARTICIPATE", translation: "repeat in file" },
      ]),
    );
    assert.equal(parsedImport[0].kind, "ready");
    assert.equal(parsedImport[1].kind, "invalid");
    assert.equal(parsedImport[2].kind, "duplicate");

    // 9. Bulk import skips existing duplicates
    const readyToImport = [
      {
        word: "appropriate",
        translation: "skip me",
        normalized: "appropriate",
      },
      {
        word: "participate",
        translation: "qatnashmoq",
        normalized: "participate",
      },
    ];

    const bulkOperations = readyToImport.map((row) => ({
      updateOne: {
        filter: { userId: userA, normalizedWord: row.normalized },
        update: {
          $setOnInsert: {
            userId: userA,
            word: row.word,
            normalizedWord: row.normalized,
            translation: row.translation,
            status: "NEW" as const,
            source: "JSON" as const,
            difficulty: 0,
            review: {
              nextReviewAt: new Date(),
              lastReviewedAt: null,
              intervalDays: 0,
              easeFactor: 2.5,
              repetitions: 0,
              correctCount: 0,
              incorrectCount: 0,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        upsert: true,
        timestamps: false,
      },
    }));

    const bulkResult = await VocabularyWord.bulkWrite(bulkOperations, {
      ordered: false,
    });
    assert.equal(bulkResult.upsertedCount, 1); // only "participate" was inserted, "appropriate" skipped

    const existingWordA = await VocabularyWord.findOne({
      userId: userA,
      normalizedWord: "appropriate",
    }).lean();
    assert.equal(existingWordA?.translation, "mos, munosib"); // untouched!

    // 10. Calendar counts are correct
    await VocabularyWord.create([
      {
        userId: userA,
        word: "day15 word",
        translation: "t1",
        createdAt: new Date("2026-09-15T10:00:00Z"),
      },
      {
        userId: userA,
        word: "day15 word 2",
        translation: "t2",
        createdAt: new Date("2026-09-15T14:00:00Z"),
      },
      {
        userId: userA,
        word: "day16 word",
        translation: "t3",
        createdAt: new Date("2026-09-16T08:00:00Z"),
      },
      {
        userId: userB,
        word: "bob day15 word",
        translation: "tbob",
        createdAt: new Date("2026-09-15T10:00:00Z"),
      },
    ]);

    const timezone = "Asia/Tashkent";
    const calendarCounts = await VocabularyWord.aggregate<{
      _id: string;
      count: number;
    }>([
      {
        $match: {
          userId: userA,
          createdAt: {
            $gte: new Date("2026-09-01T00:00:00Z"),
            $lt: new Date("2026-10-01T00:00:00Z"),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone },
          },
          count: { $sum: 1 },
        },
      },
    ]);
    const countsMap = Object.fromEntries(
      calendarCounts.map((c) => [c._id, c.count]),
    );
    assert.equal(countsMap["2026-09-15"], 2);
    assert.equal(countsMap["2026-09-16"], 1);

    // 11. Deleting vocabulary cleans review data
    const wordToDelete = await VocabularyWord.create({
      userId: userA,
      word: "litter",
      translation: "axlat",
      status: "NEW",
    });
    await VocabularyReview.create({
      userId: userA,
      vocabularyWordId: wordToDelete._id,
      nextReviewAt: wordToDelete.review.nextReviewAt,
    });

    await Promise.all([
      VocabularyWord.deleteOne({ userId: userA, _id: wordToDelete._id }),
      VocabularyReview.deleteMany({
        userId: userA,
        vocabularyWordId: wordToDelete._id,
      }),
    ]);

    assert.equal(await VocabularyWord.findById(wordToDelete._id), null);
    assert.equal(
      await VocabularyReview.countDocuments({
        userId: userA,
        vocabularyWordId: wordToDelete._id,
      }),
      0,
    );

    // 12. Dashboard vocabulary statistics are real
    // Mark one word as DIFFICULT and one as LEARNED
    await VocabularyWord.updateOne(
      { userId: userA, normalizedWord: "day15 word" },
      { $set: { status: "DIFFICULT" } },
    );
    await VocabularyWord.updateOne(
      { userId: userA, normalizedWord: "day15 word 2" },
      { $set: { status: "LEARNED" } },
    );

    const [totalWords, difficultWords, learnedWords, dueWords] =
      await Promise.all([
        VocabularyWord.countDocuments({ userId: userA }),
        VocabularyWord.countDocuments({ userId: userA, status: "DIFFICULT" }),
        VocabularyWord.countDocuments({ userId: userA, status: "LEARNED" }),
        VocabularyWord.countDocuments({
          userId: userA,
          status: { $ne: "LEARNED" },
          "review.nextReviewAt": { $lte: new Date() },
        }),
      ]);

    assert.ok(totalWords > 0);
    assert.equal(difficultWords, 1);
    assert.equal(learnedWords, 1);
    assert.ok(dueWords > 0);
    assert.equal(dueWords + learnedWords, totalWords);
  } catch (err) {
    console.error("TEST ERROR DETAILS:", err);
    throw err;
  } finally {
    await mongoose.connection.close();
    await mongoose.disconnect();
    await mongo.stop();
  }
});
