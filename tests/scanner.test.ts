import test from "node:test";
import assert from "node:assert/strict";
import { cleanOcrToken } from "../src/features/scanner/lib/normalize-token";
import {
  bboxArea,
  bboxIntersection,
  bboxIntersectionArea,
  bboxWordCoverage,
  bboxIoU,
  isUnderlineForWord,
} from "../src/features/scanner/lib/geometry";
import {
  rgbToHsv,
  classifyHighlighter,
  evaluateWordHighlight,
} from "../src/features/scanner/lib/highlight-detection";
import {
  evaluateWordUnderline,
  isDarkPixel,
} from "../src/features/scanner/lib/underline-detection";
import { evaluateWordBox } from "../src/features/scanner/lib/box-circle-detection";
import {
  matchWordsToMarks,
  sortWordsInReadingOrder,
} from "../src/features/scanner/lib/mark-matching";
import { importScannedWordsSchema } from "../src/validations/scanner";
import { VocabularyWord } from "../src/models/vocabulary-word";
import { VocabularyReview } from "../src/models/vocabulary-review";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";

// Helper to create synthetic ImageData in Node.js test environment
function createMockImageData(
  width: number,
  height: number,
  fillColor = [255, 255, 255, 255],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillColor[0];
    data[i + 1] = fillColor[1];
    data[i + 2] = fillColor[2];
    data[i + 3] = fillColor[3];
  }
  return {
    width,
    height,
    data,
    colorSpace: "srgb",
  } as ImageData;
}

// -------------------------------------------------------------
// 1. Normalization & Token Cleaning Tests
// -------------------------------------------------------------
test("cleanOcrToken cleans surrounding punctuation, brackets, and quotes", () => {
  assert.deepEqual(cleanOcrToken('"hello,"'), {
    cleanWord: "hello",
    normalizedWord: "hello",
  });
  assert.deepEqual(cleanOcrToken("[example]"), {
    cleanWord: "example",
    normalizedWord: "example",
  });
  assert.deepEqual(cleanOcrToken("(vocabulary)"), {
    cleanWord: "vocabulary",
    normalizedWord: "vocabulary",
  });
  assert.deepEqual(cleanOcrToken("amazing!"), {
    cleanWord: "amazing",
    normalizedWord: "amazing",
  });
});

test("cleanOcrToken preserves internal hyphens and apostrophes", () => {
  assert.deepEqual(cleanOcrToken("well-known,"), {
    cleanWord: "well-known",
    normalizedWord: "well-known",
  });
  assert.deepEqual(cleanOcrToken("“don't”"), {
    cleanWord: "don't",
    normalizedWord: "don't",
  });
  assert.deepEqual(cleanOcrToken("student's."), {
    cleanWord: "student's",
    normalizedWord: "student's",
  });
});

test("cleanOcrToken rejects pure numbers, symbols, and single-letter noise", () => {
  assert.equal(cleanOcrToken("123"), null);
  assert.equal(cleanOcrToken("2026"), null);
  assert.equal(cleanOcrToken("---"), null);
  assert.equal(cleanOcrToken("..."), null);
  assert.equal(cleanOcrToken("$100"), null);
  assert.equal(cleanOcrToken("!"), null);
  // Single-letter OCR noise like "x", "c" rejected, but "a" and "i" accepted
  assert.equal(cleanOcrToken("x"), null);
  assert.notEqual(cleanOcrToken("a"), null);
  assert.notEqual(cleanOcrToken("I"), null);
});

test("cleanOcrToken preserves word casing for display while normalizing for comparison", () => {
  const result = cleanOcrToken("Ephemeral;");
  assert.ok(result);
  assert.equal(result.cleanWord, "Ephemeral");
  assert.equal(result.normalizedWord, "ephemeral");
});

test("cleanOcrToken does not blindly stem words", () => {
  const running = cleanOcrToken("running,");
  assert.ok(running);
  assert.equal(running.cleanWord, "running");
  assert.equal(running.normalizedWord, "running");
});

// -------------------------------------------------------------
// 2. Geometry & Bounding Box Utilities Tests
// -------------------------------------------------------------
test("bboxArea calculates correct width * height", () => {
  assert.equal(bboxArea({ x0: 10, y0: 20, x1: 50, y1: 60 }), 40 * 40);
  assert.equal(bboxArea({ x0: 50, y0: 20, x1: 10, y1: 60 }), 0); // invalid
});

test("bboxIntersection calculates correct intersecting box", () => {
  const a = { x0: 0, y0: 0, x1: 50, y1: 50 };
  const b = { x0: 25, y0: 25, x1: 75, y1: 75 };
  const inter = bboxIntersection(a, b);
  assert.deepEqual(inter, { x0: 25, y0: 25, x1: 50, y1: 50 });
  assert.equal(bboxIntersectionArea(a, b), 25 * 25);

  const nonOverlapping = { x0: 60, y0: 60, x1: 80, y1: 80 };
  assert.equal(bboxIntersection(a, nonOverlapping), null);
  assert.equal(bboxIntersectionArea(a, nonOverlapping), 0);
});

test("bboxWordCoverage computes percentage of word covered by mark", () => {
  const word = { x0: 100, y0: 100, x1: 200, y1: 150 }; // width 100, height 50, area 5000
  const markHalf = { x0: 100, y0: 100, x1: 150, y1: 150 }; // covers 50%
  assert.equal(bboxWordCoverage(word, markHalf), 0.5);

  const markFull = { x0: 90, y0: 90, x1: 210, y1: 160 }; // covers 100%
  assert.equal(bboxWordCoverage(word, markFull), 1.0);
});

test("bboxIoU calculates intersection over union", () => {
  const a = { x0: 0, y0: 0, x1: 10, y1: 10 };
  const b = { x0: 0, y0: 0, x1: 10, y1: 10 };
  assert.equal(bboxIoU(a, b), 1.0);

  const disjoint = { x0: 20, y0: 20, x1: 30, y1: 30 };
  assert.equal(bboxIoU(a, disjoint), 0);
});

test("isUnderlineForWord matches underline directly below word", () => {
  const word = { x0: 50, y0: 50, x1: 150, y1: 80 }; // height 30, width 100
  const underline = { x0: 45, y0: 82, x1: 155, y1: 85 }; // directly under baseline

  const match = isUnderlineForWord(word, underline);
  assert.equal(match.matches, true);
  assert.ok(match.confidence >= 0.7);

  // Underline too far below word
  const farUnderline = { x0: 45, y0: 150, x1: 155, y1: 153 };
  assert.equal(isUnderlineForWord(word, farUnderline).matches, false);

  // Underline elsewhere horizontally
  const sideways = { x0: 250, y0: 82, x1: 350, y1: 85 };
  assert.equal(isUnderlineForWord(word, sideways).matches, false);
});

// -------------------------------------------------------------
// 3. Highlight Detection & Color Space Tests
// -------------------------------------------------------------
test("rgbToHsv converts RGB to accurate HSV color space", () => {
  const pureRed = rgbToHsv(255, 0, 0);
  assert.equal(Math.round(pureRed.h), 0);
  assert.equal(pureRed.s, 1);
  assert.equal(pureRed.v, 1);

  const pureYellow = rgbToHsv(255, 255, 0);
  assert.equal(Math.round(pureYellow.h), 60);

  const pureGreen = rgbToHsv(0, 255, 0);
  assert.equal(Math.round(pureGreen.h), 120);
});

test("classifyHighlighter accurately classifies highlighter colors", () => {
  // Yellow highlighter
  const yellowHsv = rgbToHsv(250, 240, 60);
  assert.equal(classifyHighlighter(yellowHsv), "yellow");

  // Green highlighter
  const greenHsv = rgbToHsv(80, 230, 90);
  assert.equal(classifyHighlighter(greenHsv), "green");

  // Pink highlighter
  const pinkHsv = rgbToHsv(255, 120, 180);
  assert.equal(classifyHighlighter(pinkHsv), "pink");

  // Orange highlighter
  const orangeHsv = rgbToHsv(255, 160, 50);
  assert.equal(classifyHighlighter(orangeHsv), "orange");

  // Blue highlighter
  const blueHsv = rgbToHsv(70, 200, 250);
  assert.equal(classifyHighlighter(blueHsv), "blue");

  // Rejections: Black text ink
  assert.equal(classifyHighlighter(rgbToHsv(15, 15, 15)), null);

  // Rejections: Plain white paper
  assert.equal(classifyHighlighter(rgbToHsv(250, 250, 250)), null);

  // Rejections: Light cream paper
  assert.equal(classifyHighlighter(rgbToHsv(245, 242, 235)), null);
});

test("evaluateWordHighlight detects highlighted word in synthetic image", () => {
  const img = createMockImageData(200, 100, [255, 255, 255, 255]); // white canvas

  // Draw yellow highlighter over word area [20, 20, 100, 50]
  for (let y = 20; y < 50; y++) {
    for (let x = 20; x < 100; x++) {
      const idx = (y * 200 + x) * 4;
      img.data[idx] = 250; // Yellow highlighter
      img.data[idx + 1] = 240;
      img.data[idx + 2] = 60;
      img.data[idx + 3] = 255;
    }
  }

  // Draw some black letters inside the word box
  for (let y = 25; y < 45; y++) {
    for (let x = 30; x < 35; x++) {
      const idx = (y * 200 + x) * 4;
      img.data[idx] = 20;
      img.data[idx + 1] = 20;
      img.data[idx + 2] = 20;
    }
  }

  // Evaluate highlighted word
  const hlWord = evaluateWordHighlight(img, {
    x0: 20,
    y0: 20,
    x1: 100,
    y1: 50,
  });
  assert.equal(hlWord.isHighlighted, true);
  assert.equal(hlWord.colorName, "yellow");
  assert.ok(hlWord.confidence >= 0.7);

  // Evaluate unhighlighted word area [110, 20, 180, 50]
  const unhlWord = evaluateWordHighlight(img, {
    x0: 110,
    y0: 20,
    x1: 180,
    y1: 50,
  });
  assert.equal(unhlWord.isHighlighted, false);
});

// -------------------------------------------------------------
// 4. Underline Detection Tests
// -------------------------------------------------------------
test("isDarkPixel distinguishes dark ink from white paper", () => {
  assert.equal(isDarkPixel(20, 20, 20), true); // black ink
  assert.equal(isDarkPixel(250, 250, 250), false); // white paper
});

test("evaluateWordUnderline detects physical drawn underline below word", () => {
  const img = createMockImageData(200, 100, [255, 255, 255, 255]);

  // Word box at [30, 20, 120, 45] (height 25, width 90)
  // Draw an underline line at y = 48 from x = 28 to x = 122
  for (let dy = 0; dy < 2; dy++) {
    for (let x = 28; x <= 122; x++) {
      const idx = ((48 + dy) * 200 + x) * 4;
      img.data[idx] = 30; // dark pen ink
      img.data[idx + 1] = 30;
      img.data[idx + 2] = 30;
    }
  }

  const result = evaluateWordUnderline(img, {
    x0: 30,
    y0: 20,
    x1: 120,
    y1: 45,
  });
  assert.equal(result.isUnderlined, true);
  assert.ok(result.confidence >= 0.7);

  // Word with no underline at [30, 60, 120, 85]
  const noUnderline = evaluateWordUnderline(img, {
    x0: 30,
    y0: 60,
    x1: 120,
    y1: 85,
  });
  assert.equal(noUnderline.isUnderlined, false);
});

// -------------------------------------------------------------
// 5. Box Detection Tests
// -------------------------------------------------------------
test("evaluateWordBox detects border lines enclosing a word", () => {
  const img = createMockImageData(200, 100, [255, 255, 255, 255]);

  // Word box at [40, 30, 100, 60] (width 60, height 30)
  // Outer box perimeter at [35, 25, 105, 65]
  const x0 = 35;
  const x1 = 105;
  const y0 = 25;
  const y1 = 65;

  // Draw top and bottom borders
  for (let x = x0; x <= x1; x++) {
    const topIdx = (y0 * 200 + x) * 4;
    img.data[topIdx] = 20;
    img.data[topIdx + 1] = 20;
    img.data[topIdx + 2] = 20;

    const botIdx = (y1 * 200 + x) * 4;
    img.data[botIdx] = 20;
    img.data[botIdx + 1] = 20;
    img.data[botIdx + 2] = 20;
  }

  // Draw left and right borders
  for (let y = y0; y <= y1; y++) {
    const leftIdx = (y * 200 + x0) * 4;
    img.data[leftIdx] = 20;
    img.data[leftIdx + 1] = 20;
    img.data[leftIdx + 2] = 20;

    const rightIdx = (y * 200 + x1) * 4;
    img.data[rightIdx] = 20;
    img.data[rightIdx + 1] = 20;
    img.data[rightIdx + 2] = 20;
  }

  const boxResult = evaluateWordBox(img, {
    x0: 40,
    y0: 30,
    x1: 100,
    y1: 60,
  });
  assert.equal(boxResult.isBoxed, true);
  assert.ok(boxResult.confidence >= 0.7);

  // Unboxed word
  const unboxed = evaluateWordBox(img, {
    x0: 120,
    y0: 30,
    x1: 180,
    y1: 60,
  });
  assert.equal(unboxed.isBoxed, false);
});

// -------------------------------------------------------------
// 6. Matching OCR Words to Marks & Reading Order Tests
// -------------------------------------------------------------
test("sortWordsInReadingOrder groups by lines and sorts left-to-right", () => {
  const line2Word2 = { bbox: { x0: 120, y0: 60, x1: 180, y1: 80 } };
  const line1Word1 = { bbox: { x0: 20, y0: 20, x1: 80, y1: 40 } };
  const line1Word2 = { bbox: { x0: 90, y0: 22, x1: 150, y1: 42 } };
  const line2Word1 = { bbox: { x0: 20, y0: 58, x1: 90, y1: 78 } };

  const sorted = sortWordsInReadingOrder([
    line2Word2,
    line1Word2,
    line2Word1,
    line1Word1,
  ]);

  assert.equal(sorted[0], line1Word1);
  assert.equal(sorted[1], line1Word2);
  assert.equal(sorted[2], line2Word1);
  assert.equal(sorted[3], line2Word2);
});

test("matchWordsToMarks separates marked words from other recognized words", () => {
  const ocrWords = [
    {
      text: "highlighted,",
      confidence: 95,
      bbox: { x0: 20, y0: 20, x1: 100, y1: 50 },
    },
    {
      text: "ordinary",
      confidence: 90,
      bbox: { x0: 110, y0: 20, x1: 180, y1: 50 },
    },
    {
      text: "underlined.",
      confidence: 92,
      bbox: { x0: 20, y0: 60, x1: 100, y1: 90 },
    },
  ];

  const markRegions = [
    {
      type: "highlight" as const,
      bbox: { x0: 15, y0: 15, x1: 105, y1: 55 },
      confidence: 0.9,
      colorName: "yellow",
    },
    {
      type: "underline" as const,
      bbox: { x0: 18, y0: 92, x1: 102, y1: 95 },
      confidence: 0.85,
    },
  ];

  const result = matchWordsToMarks(ocrWords, markRegions, null);

  assert.equal(result.detectedWords.length, 2);
  assert.equal(result.detectedWords[0].text, "highlighted");
  assert.equal(result.detectedWords[0].markType, "highlight");
  assert.equal(result.detectedWords[0].selected, true);

  assert.equal(result.detectedWords[1].text, "underlined");
  assert.equal(result.detectedWords[1].markType, "underline");
  assert.equal(result.detectedWords[1].selected, true);

  assert.equal(result.otherWords.length, 1);
  assert.equal(result.otherWords[0].text, "ordinary");
  assert.equal(result.otherWords[0].markType, "manual");
  assert.equal(result.otherWords[0].selected, false);
});

// -------------------------------------------------------------
// 7. Zod Schema Validation Tests
// -------------------------------------------------------------
test("importScannedWordsSchema validates word constraints and array length", () => {
  const valid = importScannedWordsSchema.parse({
    words: [
      { word: "serendipity", translation: "kutilmagan baxt" },
      { word: "resilient" },
    ],
  });
  assert.equal(valid.words.length, 2);
  assert.equal(valid.words[0].translation, "kutilmagan baxt");
  assert.equal(valid.words[1].notes, "Imported from textbook scan");

  // Empty words array rejected
  assert.equal(
    importScannedWordsSchema.safeParse({ words: [] }).success,
    false,
  );

  // Empty word string rejected
  assert.equal(
    importScannedWordsSchema.safeParse({
      words: [{ word: "   " }],
    }).success,
    false,
  );
});

// -------------------------------------------------------------
// 8. Integration & Database Tests (MongoMemoryServer)
// -------------------------------------------------------------
test("Scanner Vocabulary Import with Deduplication and Ownership", async () => {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri("scanner_tests");
  await mongoose.connect(uri);

  try {
    await Promise.all([
      VocabularyWord.createIndexes(),
      VocabularyReview.createIndexes(),
    ]);

    const userA = new Types.ObjectId();
    const userB = new Types.ObjectId();

    // Seed User A with existing word "diligent"
    await VocabularyWord.create({
      userId: userA,
      word: "diligent",
      normalizedWord: "diligent",
      translation: "mehnatkash",
      status: "NEW",
      source: "MANUAL",
    });

    // Test import logic for User A:
    // Candidate list:
    // 1. "diligent" (duplicate -> should be skipped)
    // 2. "eloquent" (new -> should be imported)
    // 3. "perseverance" (new -> should be imported)
    // 4. "eloquent" (internal duplicate -> should be skipped)
    const rawCandidates = [
      { word: "diligent", translation: "g'ayratli" },
      { word: "eloquent", translation: "notiq, fasih" },
      { word: "perseverance", translation: "matonat" },
      { word: "eloquent", translation: "takroriy" },
    ];

    // Deduplicate within payload
    const map = new Map<
      string,
      { word: string; translation: string; normalized: string }
    >();
    let internalDups = 0;
    for (const c of rawCandidates) {
      const norm = c.word.trim().toLowerCase();
      if (map.has(norm)) {
        internalDups++;
      } else {
        map.set(norm, {
          word: c.word,
          translation: c.translation,
          normalized: norm,
        });
      }
    }
    assert.equal(internalDups, 1);

    const candidates = Array.from(map.values());
    const existing = await VocabularyWord.find({
      userId: userA,
      normalizedWord: { $in: candidates.map((c) => c.normalized) },
    }).lean();

    const existingSet = new Set(existing.map((e) => e.normalizedWord));
    const ready = candidates.filter((c) => !existingSet.has(c.normalized));

    assert.equal(ready.length, 2); // "eloquent" and "perseverance"

    // Execute bulk upsert
    const ops = ready.map((item) => ({
      updateOne: {
        filter: { userId: userA, normalizedWord: item.normalized },
        update: {
          $setOnInsert: {
            userId: userA,
            word: item.word,
            normalizedWord: item.normalized,
            translation: item.translation,
            source: "IMAGE" as const,
            status: "NEW" as const,
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

    const bulkRes = await VocabularyWord.bulkWrite(ops);
    assert.equal(bulkRes.upsertedCount, 2);

    // Verify User A has 3 words
    const userAWords = await VocabularyWord.find({ userId: userA }).lean();
    assert.equal(userAWords.length, 3);

    // Verify source is "IMAGE" for scanned words
    const eloquent = userAWords.find((w) => w.normalizedWord === "eloquent");
    assert.ok(eloquent);
    assert.equal(eloquent.source, "IMAGE");

    // Verify User B is isolated and has 0 words
    const userBWords = await VocabularyWord.find({ userId: userB }).lean();
    assert.equal(userBWords.length, 0);

    // Existing word "diligent" was not overwritten
    const diligent = userAWords.find((w) => w.normalizedWord === "diligent");
    assert.equal(diligent?.translation, "mehnatkash");
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});
