import test from "node:test";
import assert from "node:assert/strict";
import type { GoogleGenAI } from "@google/genai";
import {
  GeminiProvider,
  DEFAULT_GEMINI_MODEL,
} from "../src/lib/ai/gemini-provider";
import { getAiProvider, setCustomAiProvider } from "../src/lib/ai/provider";
import { AiConfigurationError, AiServiceError } from "../src/lib/ai/types";

// 1. Missing GEMINI_API_KEY throws clear AiConfigurationError
test("GeminiProvider throws AiConfigurationError when API key is missing", () => {
  const prevKey = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    assert.throws(
      () => new GeminiProvider(),
      (err: unknown) =>
        err instanceof AiConfigurationError &&
        err.message.includes("Gemini API key is not configured"),
    );
  } finally {
    process.env.GEMINI_API_KEY = prevKey;
  }
});

// 2. Default model configuration
test("GeminiProvider uses centralized default model or env override", () => {
  const dummyClient = {
    models: { generateContent: async () => ({ text: "{}" }) },
  } as unknown as GoogleGenAI;

  const defaultProvider = new GeminiProvider(
    "dummy-key",
    undefined,
    dummyClient,
  );
  assert.equal(defaultProvider.model, DEFAULT_GEMINI_MODEL);
  assert.equal(defaultProvider.name, "GEMINI");

  const customProvider = new GeminiProvider(
    "dummy-key",
    "gemini-custom-pro",
    dummyClient,
  );
  assert.equal(customProvider.model, "gemini-custom-pro");
});

// 3. Image payload construction and structured candidate extraction with mocked client
test("GeminiProvider correctly constructs vision payload and parses candidates", async () => {
  let capturedParams: unknown = null;

  const mockClient = {
    models: {
      generateContent: async (params: unknown) => {
        capturedParams = params;
        return {
          text: JSON.stringify({
            candidates: [
              {
                word: "appropriate",
                confidence: 0.97,
                markingType: "HIGHLIGHTED",
                context: "This dress is appropriate for the business meeting.",
              },
              {
                word: "look after",
                confidence: 0.94,
                markingType: "UNDERLINED",
                context: "She had to look after her younger brother.",
              },
              {
                word: "participate",
                confidence: 0.89,
                markingType: "CIRCLED",
                context: "Students participate actively in lessons.",
              },
            ],
          }),
        };
      },
    },
  } as unknown as GoogleGenAI;

  const provider = new GeminiProvider(
    "test-key",
    "gemini-2.5-flash",
    mockClient,
  );
  const testBuffer = Buffer.from("fake-png-image-binary-data");
  const candidates = await provider.extractVocabularyFromImage(
    testBuffer,
    "image/png",
  );

  // Verify payload structure sent to Gemini
  assert.ok(capturedParams);
  const params = capturedParams as {
    model: string;
    contents: Array<{
      role: string;
      parts: Array<{
        inlineData?: { mimeType: string; data: string };
        text?: string;
      }>;
    }>;
    config: {
      systemInstruction: string;
      responseMimeType: string;
      temperature: number;
    };
  };

  assert.equal(params.model, "gemini-2.5-flash");
  assert.equal(params.config.responseMimeType, "application/json");
  assert.equal(params.config.temperature, 0.2);
  assert.ok(params.config.systemInstruction.includes("English-learning"));

  // Verify inline image payload
  const imagePart = params.contents[0].parts.find((p) => p.inlineData);
  assert.ok(imagePart?.inlineData);
  assert.equal(imagePart.inlineData.mimeType, "image/png");
  assert.equal(imagePart.inlineData.data, testBuffer.toString("base64"));

  // Verify parsed candidate objects and preserved phrasal verbs
  assert.equal(candidates.length, 3);
  assert.equal(candidates[0].word, "appropriate");
  assert.equal(candidates[0].markingType, "HIGHLIGHTED");
  assert.equal(candidates[0].confidence, 0.97);

  // Phrasal verb preserved intact
  assert.equal(candidates[1].word, "look after");
  assert.equal(candidates[1].markingType, "UNDERLINED");
  assert.equal(
    candidates[1].context,
    "She had to look after her younger brother.",
  );

  assert.equal(candidates[2].word, "participate");
  assert.equal(candidates[2].markingType, "CIRCLED");
});

// 4. Vocabulary enrichment parsing with mocked Gemini client
test("GeminiProvider enriches selected candidates with Uzbek translations and learner definitions", async () => {
  let capturedParams: unknown = null;

  const mockClient = {
    models: {
      generateContent: async (params: unknown) => {
        capturedParams = params;
        return {
          text: JSON.stringify({
            items: [
              {
                id: "cand_1",
                word: "appropriate",
                translation: "mos, munosib",
                definition: "suitable or correct for a particular situation",
                example: "This dress is appropriate for the business meeting.",
                partOfSpeech: "adjective",
                pronunciation: "/əˈprəʊpriət/",
                synonyms: ["suitable", "proper", "fitting"],
              },
              {
                id: "cand_2",
                word: "look after",
                translation: "g'amxo'rlik qilmoq, qaramoq",
                definition: "to take care of someone or something",
                example: "She had to look after her younger brother.",
                partOfSpeech: "phrasal verb",
                pronunciation: "/lʊk ˈɑːftər/",
                synonyms: ["take care of", "attend to"],
              },
            ],
          }),
        };
      },
    },
  } as unknown as GoogleGenAI;

  const provider = new GeminiProvider(
    "test-key",
    "gemini-2.5-flash",
    mockClient,
  );
  const candidates = [
    {
      id: "cand_1",
      word: "appropriate",
      context: "This dress is appropriate.",
    },
    {
      id: "cand_2",
      word: "look after",
      context: "She had to look after her brother.",
    },
  ];

  const enriched = await provider.enrichVocabulary(candidates);

  assert.ok(capturedParams);
  assert.equal(enriched.length, 2);

  // Verify Uzbek translation & learner details
  assert.equal(enriched[0].id, "cand_1");
  assert.equal(enriched[0].word, "appropriate");
  assert.equal(enriched[0].translation, "mos, munosib");
  assert.equal(
    enriched[0].definition,
    "suitable or correct for a particular situation",
  );
  assert.equal(enriched[0].partOfSpeech, "adjective");
  assert.ok(enriched[0].synonyms.includes("suitable"));

  // Verify phrasal verb enrichment
  assert.equal(enriched[1].id, "cand_2");
  assert.equal(enriched[1].word, "look after");
  assert.equal(enriched[1].translation, "g'amxo'rlik qilmoq, qaramoq");
  assert.equal(enriched[1].partOfSpeech, "phrasal verb");
});

// 5. Single word autofill delegation
test("GeminiProvider enrichSingleWord delegates to enrichment", async () => {
  const mockClient = {
    models: {
      generateContent: async () => ({
        text: JSON.stringify({
          items: [
            {
              id: "single_word",
              word: "essential",
              translation: "zarur, o'ta muhim",
              definition: "completely necessary",
              example: "Clean water is essential.",
              partOfSpeech: "adjective",
              pronunciation: "/ɪˈsenʃl/",
              synonyms: ["vital", "crucial"],
            },
          ],
        }),
      }),
    },
  } as unknown as GoogleGenAI;

  const provider = new GeminiProvider(
    "test-key",
    "gemini-2.5-flash",
    mockClient,
  );
  const single = await provider.enrichSingleWord("essential");

  assert.equal(single.word, "essential");
  assert.equal(single.translation, "zarur, o'ta muhim");
  assert.equal(single.partOfSpeech, "adjective");
});

// 6. Malformed JSON handling without crashing
test("GeminiProvider handles malformed JSON and non-schema responses gracefully", async () => {
  const malformedClient = {
    models: {
      generateContent: async () => ({
        text: "This is not valid JSON at all",
      }),
    },
  } as unknown as GoogleGenAI;

  const provider = new GeminiProvider(
    "test-key",
    "gemini-2.5-flash",
    malformedClient,
  );

  await assert.rejects(
    () =>
      provider.extractVocabularyFromImage(Buffer.from("dummy"), "image/png"),
    (err: unknown) =>
      err instanceof AiServiceError &&
      err.message.includes("Gemini returned malformed JSON"),
  );

  await assert.rejects(
    () => provider.enrichVocabulary([{ id: "1", word: "test" }]),
    (err: unknown) =>
      err instanceof AiServiceError &&
      err.message.includes("Gemini returned malformed enrichment data"),
  );
});

// 7. Provider factory selection tests
test("getAiProvider resolves GEMINI when AI_PROVIDER=gemini", () => {
  const prevProvider = process.env.AI_PROVIDER;
  const prevGeminiKey = process.env.GEMINI_API_KEY;
  const prevNodeEnv = process.env.NODE_ENV;
  const prevPlaywright = process.env.PLAYWRIGHT_TEST;

  try {
    delete process.env.PLAYWRIGHT_TEST;
    // @ts-expect-error override readonly for test
    process.env.NODE_ENV = "production";
    setCustomAiProvider(null);

    // With GEMINI_API_KEY
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    const provider = getAiProvider();
    assert.equal(provider.name, "GEMINI");

    // With AI_PROVIDER=gemini but missing key -> throws AiConfigurationError
    delete process.env.GEMINI_API_KEY;
    assert.throws(
      () => getAiProvider(),
      (err: unknown) =>
        err instanceof AiConfigurationError &&
        err.message.includes("Gemini API key is not configured"),
    );
  } finally {
    process.env.AI_PROVIDER = prevProvider;
    process.env.GEMINI_API_KEY = prevGeminiKey;
    // @ts-expect-error restore
    process.env.NODE_ENV = prevNodeEnv;
    process.env.PLAYWRIGHT_TEST = prevPlaywright;
    setCustomAiProvider(null);
  }
});
