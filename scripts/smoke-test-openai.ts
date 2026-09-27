/**
 * Optional manual smoke test for real OpenAI Vision & Enrichment API calls.
 * This script is ONLY run manually when explicitly requested and OPENAI_API_KEY exists.
 * It is NEVER run during normal automated test suites (pnpm test or pnpm test:e2e).
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx tsx scripts/smoke-test-openai.ts
 */

import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.log(
      "\n⚠️  OPENAI_API_KEY is not set in the environment or .env file.\n" +
        "   Skipping live OpenAI API smoke test.\n" +
        "   To run live tests, export OPENAI_API_KEY=sk-... and run:\n" +
        "   npx tsx scripts/smoke-test-openai.ts\n",
    );
    process.exit(0);
  }

  console.log(
    "🔑 OPENAI_API_KEY detected. Running live OpenAI vision & enrichment smoke test...",
  );

  const { OpenAiProvider } = await import("../src/lib/ai/openai-provider");
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
  const provider = new OpenAiProvider(apiKey, model);

  // 1. Test image extraction with local fixture
  const fixturePath = path.join(
    process.cwd(),
    "tests",
    "fixtures",
    "sample-textbook.png",
  );
  if (!fs.existsSync(fixturePath)) {
    console.error("❌ Test fixture not found at:", fixturePath);
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(fixturePath);
  console.log(
    `\n📸 [1/2] Sending test image to OpenAI Vision model: ${model}...`,
  );

  try {
    const candidates = await provider.extractVocabularyFromImage(
      imageBuffer,
      "image/png",
    );
    console.log(
      `✅ Extraction successful! Received ${candidates.length} candidate(s):`,
    );
    console.dir(candidates, { depth: null });

    // 2. Test vocabulary enrichment
    console.log(
      `\n📚 [2/2] Sending candidate enrichment request to OpenAI model: ${model}...`,
    );
    const toEnrich = [
      {
        id: "smoke_1",
        word: "appropriate",
        context: "This dress is appropriate for the business conference.",
      },
      {
        id: "smoke_2",
        word: "look after",
        context: "She had to look after her younger brother.",
      },
    ];

    const enriched = await provider.enrichVocabulary(toEnrich);
    console.log(
      `✅ Enrichment successful! Received ${enriched.length} enriched item(s):`,
    );
    console.dir(enriched, { depth: null });

    console.log("\n🎉 Live OpenAI smoke test passed successfully!");
  } catch (error) {
    console.error("❌ Live OpenAI smoke test failed:", error);
    process.exit(1);
  }
}

main();
