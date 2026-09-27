import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import mongoose, { Types } from "mongoose";
import { detectImageMimeType } from "../src/lib/ai/image-utils";
import { MockAiProvider } from "../src/lib/ai/mock-provider";
import { AiConfigurationError } from "../src/lib/ai/types";
import { setCustomAiProvider, getAiProvider } from "../src/lib/ai/provider";
import {
  rawExtractionResponseSchema,
  rawEnrichmentResponseSchema,
} from "../src/validations/ai";
import { normalizeWord } from "../src/features/vocabulary/constants";
import { VocabularyWord } from "../src/models/vocabulary-word";
import { VocabularyReview } from "../src/models/vocabulary-review";
import { AiUsage } from "../src/models/ai-usage";
import { RateLimit } from "../src/models/rate-limit";

// 1. Image validation tests (magic bytes)
test("image mime type detection via magic bytes", () => {
  // Valid JPEG header
  const jpegHeader = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);
  assert.equal(detectImageMimeType(jpegHeader), "image/jpeg");

  // Valid PNG header
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  assert.equal(detectImageMimeType(pngHeader), "image/png");

  // Valid WEBP header (RIFF....WEBP)
  const webpHeader = Buffer.from("RIFF1234WEBPVP8 ");
  assert.equal(detectImageMimeType(webpHeader), "image/webp");

  // Invalid: Plain text or PDF or too short
  const textBuffer = Buffer.from(
    "Hello world, this is a plain text file pretending to be an image.",
  );
  assert.equal(detectImageMimeType(textBuffer), null);

  const shortBuffer = Buffer.from([0xff, 0xd8]);
  assert.equal(detectImageMimeType(shortBuffer), null);
});

// 2. Real test fixture verification
test("test fixture sample-textbook.png is a valid PNG image", () => {
  const fixturePath = path.join(
    process.cwd(),
    "tests",
    "fixtures",
    "sample-textbook.png",
  );
  assert.ok(fs.existsSync(fixturePath), "Fixture file should exist");
  const buffer = fs.readFileSync(fixturePath);
  assert.equal(detectImageMimeType(buffer), "image/png");
});

// 3. Mock AI Provider extraction tests
test("mock AI provider extracts marked words and preserves multi-word phrasal verbs", async () => {
  const provider = new MockAiProvider();
  const dummyBuffer = Buffer.from("dummy");
  const candidates = await provider.extractVocabularyFromImage(
    dummyBuffer,
    "image/png",
  );

  assert.ok(candidates.length >= 4);

  // Check highlighted word
  const highlighted = candidates.find((c) => c.markingType === "HIGHLIGHTED");
  assert.ok(highlighted);
  assert.equal(highlighted.word, "appropriate");
  assert.ok(highlighted.confidence > 0.9);

  // Check underlined phrasal verb is preserved intact
  const underlined = candidates.find((c) => c.markingType === "UNDERLINED");
  assert.ok(underlined);
  assert.equal(underlined.word, "look after"); // Preserved as phrase, not split
  assert.ok(underlined.confidence > 0.9);

  // Check boxed candidate
  const boxed = candidates.find((c) => c.markingType === "BOXED");
  assert.ok(boxed);
  assert.equal(boxed.word, "essential");

  // Check pen mark / low confidence candidate
  const penMark = candidates.find((c) => c.markingType === "PEN_MARK");
  assert.ok(penMark);
  assert.ok(penMark.confidence < 0.75); // Low confidence
});

// 4. Mock AI Provider empty extraction handling
test("mock AI provider handles empty extraction gracefully", async () => {
  const provider = new MockAiProvider({ empty: true });
  const candidates = await provider.extractVocabularyFromImage(
    Buffer.from("dummy"),
    "image/png",
  );
  assert.deepEqual(candidates, []);
});

// 5. Mock AI Provider failure and malformed response handling
test("mock AI provider handles simulated failures", async () => {
  const failingProvider = new MockAiProvider({ failExtraction: true });
  await assert.rejects(
    () =>
      failingProvider.extractVocabularyFromImage(
        Buffer.from("dummy"),
        "image/png",
      ),
    /Simulated extraction error/,
  );

  const malformedProvider = new MockAiProvider({ malformed: true });
  await assert.rejects(
    () =>
      malformedProvider.extractVocabularyFromImage(
        Buffer.from("dummy"),
        "image/png",
      ),
    /Simulated malformed JSON/,
  );
});

// 6. Two-stage enrichment: Uzbek translation and metadata generation
test("two-stage enrichment produces Uzbek translation, learner definition and example", async () => {
  const provider = new MockAiProvider();
  const selectedCandidates = [
    {
      id: "cand_1",
      word: "appropriate",
      context: "This dress is appropriate.",
    },
    { id: "cand_2", word: "look after", context: "Look after her brother." },
  ];

  const enriched = await provider.enrichVocabulary(selectedCandidates);
  assert.equal(enriched.length, 2);

  // Check Uzbek translation
  assert.equal(enriched[0].word, "appropriate");
  assert.equal(enriched[0].translation, "mos, munosib");
  assert.ok(enriched[0].definition.length > 5);
  assert.ok(enriched[0].example.length > 5);
  assert.equal(enriched[0].partOfSpeech, "adjective");
  assert.ok(Array.isArray(enriched[0].synonyms));
  assert.ok(enriched[0].synonyms.includes("suitable"));

  // Check phrasal verb enrichment
  assert.equal(enriched[1].word, "look after");
  assert.equal(enriched[1].translation, "g'amxo'rlik qilmoq, qaramoq");
  assert.equal(enriched[1].partOfSpeech, "phrasal verb");
});

// 7. Missing API key behavior
// 7. Missing API key behavior
test("missing OpenAI API key throws clear AiConfigurationError", () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  const previousProvider = process.env.AI_PROVIDER;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousPlaywright = process.env.PLAYWRIGHT_TEST;

  try {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.PLAYWRIGHT_TEST;
    process.env.AI_PROVIDER = "openai";
    // @ts-expect-error override readonly for test
    process.env.NODE_ENV = "production";
    setCustomAiProvider(null);

    assert.throws(
      () => getAiProvider(),
      (err: unknown) =>
        err instanceof AiConfigurationError &&
        err.message.includes("OpenAI API key is not configured"),
    );
  } finally {
    process.env.OPENAI_API_KEY = previousKey;
    process.env.GEMINI_API_KEY = previousGeminiKey;
    process.env.AI_PROVIDER = previousProvider;
    // @ts-expect-error restore
    process.env.NODE_ENV = previousNodeEnv;
    process.env.PLAYWRIGHT_TEST = previousPlaywright;
  }
});

// 8. Zod validation schemas for AI outputs
test("Zod validation schemas safely parse AI structures", () => {
  // Extraction validation
  const rawExtraction = {
    candidates: [
      {
        word: "appropriate",
        confidence: 0.95,
        markingType: "highlighted",
        context: "sentence context",
      },
      {
        word: "take part in",
        confidence: 0.88,
        markingType: "UNDERLINED",
        context: "take part in games",
      },
    ],
  };

  const parsedExtraction = rawExtractionResponseSchema.safeParse(rawExtraction);
  assert.equal(parsedExtraction.success, true);
  if (parsedExtraction.success) {
    assert.equal(
      parsedExtraction.data.candidates[0].markingType,
      "HIGHLIGHTED",
    );
    assert.equal(parsedExtraction.data.candidates[1].word, "take part in");
  }

  // Enrichment validation
  const rawEnrichment = {
    items: [
      {
        id: "1",
        word: "appropriate",
        translation: "mos",
        definition: "suitable",
        example: "appropriate dress",
        partOfSpeech: "adjective",
        pronunciation: "/əˈprəʊpriət/",
        synonyms: ["suitable", "proper"],
      },
    ],
  };

  const parsedEnrichment = rawEnrichmentResponseSchema.safeParse(rawEnrichment);
  assert.equal(parsedEnrichment.success, true);
});

// 9. Database Integration Tests with MongoMemoryServer
test("database integration: duplicate detection, image import persistence, review initialization and ownership isolation", async () => {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri("ai_import_tests");
  await mongoose.connect(uri);

  try {
    await Promise.all([
      VocabularyWord.createIndexes(),
      VocabularyReview.createIndexes(),
      AiUsage.createIndexes(),
      RateLimit.createIndexes(),
    ]);

    const userA = new Types.ObjectId();
    const userB = new Types.ObjectId();

    // Setup: User A already has "appropriate" in their notebook
    await VocabularyWord.create({
      userId: userA,
      word: "Appropriate",
      translation: "mos",
      status: "NEW",
      source: "MANUAL",
    });

    // 9.1 Duplicate detection for User A
    const incomingWords = ["Appropriate", "look after", "participate"];
    const normalizedIncoming = incomingWords.map(normalizeWord);

    const existingForUserA = await VocabularyWord.find({
      userId: userA,
      normalizedWord: { $in: normalizedIncoming },
    })
      .select("normalizedWord")
      .lean();

    const existingSetA = new Set(existingForUserA.map((w) => w.normalizedWord));
    assert.equal(existingSetA.has("appropriate"), true);
    assert.equal(existingSetA.has("look after"), false);
    assert.equal(existingSetA.has("participate"), false);

    // 9.2 User B does NOT have "appropriate" -> Isolation check
    const existingForUserB = await VocabularyWord.find({
      userId: userB,
      normalizedWord: { $in: normalizedIncoming },
    })
      .select("normalizedWord")
      .lean();

    const existingSetB = new Set(existingForUserB.map((w) => w.normalizedWord));
    assert.equal(existingSetB.has("appropriate"), false); // User B is isolated!

    // 9.3 Simulating Confirm Image Import for User A
    // Filter out duplicates
    const toImport = [
      {
        word: "look after",
        translation: "g'amxo'rlik qilmoq",
        definition: "to take care of",
        example: "Look after children.",
        partOfSpeech: "phrasal verb",
        pronunciation: "/lʊk ˈɑːftər/",
        synonyms: ["take care of"],
      },
      {
        word: "participate",
        translation: "qatnashmoq",
        definition: "to take part",
        example: "Participate in lessons.",
        partOfSpeech: "verb",
        pronunciation: "/pɑːˈtɪsɪpeɪt/",
        synonyms: ["join in"],
      },
    ];

    const operations = toImport.map((item) => {
      const doc = new VocabularyWord({
        userId: userA,
        word: item.word,
        normalizedWord: normalizeWord(item.word),
        translation: item.translation,
        definition: item.definition,
        example: item.example,
        partOfSpeech: item.partOfSpeech,
        pronunciation: item.pronunciation,
        notes: `Synonyms: ${item.synonyms.join(", ")}`,
        source: "IMAGE",
        status: "NEW",
      });
      const value = doc.toObject();
      return {
        updateOne: {
          filter: { userId: userA, normalizedWord: normalizeWord(item.word) },
          update: {
            $setOnInsert: {
              ...value,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          upsert: true,
          timestamps: false,
        },
      };
    });

    const bulkResult = await VocabularyWord.bulkWrite(operations, {
      ordered: false,
    });
    assert.equal(bulkResult.upsertedCount, 2);

    // 9.4 Spaced repetition reviews must be initialized for newly imported words
    const missing = await VocabularyWord.find({
      userId: userA,
      source: "IMAGE",
    })
      .select("_id review createdAt")
      .lean();
    const reviewDocs = missing.map((w) => ({
      userId: userA,
      vocabularyWordId: w._id,
      nextReviewAt: w.review?.nextReviewAt || new Date(),
      lastReviewedAt: null,
      intervalDays: 0,
      easeFactor: 2.5,
      repetitions: 0,
      correctCount: 0,
      incorrectCount: 0,
      lastRating: null,
      createdAt: w.createdAt || new Date(),
    }));
    await VocabularyReview.insertMany(reviewDocs, { ordered: false });

    const importedWords = await VocabularyWord.find({
      userId: userA,
      source: "IMAGE",
    }).lean();

    assert.equal(importedWords.length, 2);
    for (const w of importedWords) {
      assert.equal(w.source, "IMAGE");
      assert.equal(w.status, "NEW");

      // Verify canonical VocabularyReview exists for spaced repetition
      const review = await VocabularyReview.findOne({
        userId: userA,
        vocabularyWordId: w._id,
      }).lean();

      assert.ok(review, `VocabularyReview should exist for ${w.word}`);
      assert.equal(review.repetitions, 0);
      assert.ok(review.nextReviewAt <= new Date());
    }

    // 9.5 AI Usage tracking logging
    const usageRecord = await AiUsage.create({
      userId: userA,
      operation: "IMAGE_EXTRACTION",
      model: "gpt-4o-mini",
      success: true,
      itemCount: 2,
    });
    assert.ok(usageRecord._id);
    assert.equal(usageRecord.operation, "IMAGE_EXTRACTION");
    assert.equal(usageRecord.itemCount, 2);
  } finally {
    await mongoose.connection.close();
    await mongoose.disconnect();
    await mongo.stop();
  }
});
