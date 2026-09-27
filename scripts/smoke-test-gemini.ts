/**
 * Live smoke test for Google Gemini Vision & Vocabulary Enrichment API calls.
 * This script is ONLY run manually when explicitly requested and GEMINI_API_KEY exists.
 * It is NEVER run during normal automated test suites (pnpm test, pnpm test:e2e, or pnpm build).
 *
 * Usage:
 *   pnpm smoke:gemini
 *   pnpm smoke:gemini -- /path/to/textbook-page.jpg
 *   GEMINI_API_KEY=AIza... pnpm smoke:gemini -- ./photo.png
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.log(
      "\n⚠️  GEMINI_API_KEY is not set in the environment or .env file.\n" +
        "   Skipping live Google Gemini API smoke test.\n" +
        "   To run live tests with your Gemini Developer API key, export:\n" +
        "   export GEMINI_API_KEY=your_key_here\n" +
        "   pnpm smoke:gemini -- /path/to/textbook.jpg\n",
    );
    process.exit(0);
  }

  // Parse image path from CLI args (skip any leading '--')
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  let imagePath = args[0];

  if (!imagePath) {
    imagePath = path.join(
      process.cwd(),
      "tests",
      "fixtures",
      "sample-textbook.png",
    );
    console.log(
      `ℹ️  No image path specified. Defaulting to fixture: ${imagePath}`,
    );
  } else {
    imagePath = path.resolve(process.cwd(), imagePath);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image file not found at: ${imagePath}`);
    process.exit(1);
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  console.log(`\n🔑 GEMINI_API_KEY detected.`);
  console.log(`🤖 Model: ${model}`);
  console.log(`📄 Analyzing image: ${imagePath}`);

  const { GeminiProvider } = await import("../src/lib/ai/gemini-provider");
  const { detectImageMimeType } = await import("../src/lib/ai/image-utils");

  const imageBuffer = fs.readFileSync(imagePath);
  let mimeType = detectImageMimeType(imageBuffer);
  if (!mimeType) {
    const ext = path.extname(imagePath).toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".png") mimeType = "image/png";
    else if (ext === ".webp") mimeType = "image/webp";
    else {
      console.error(
        "❌ Unsupported image type. Please provide a JPG, PNG, or WEBP file.",
      );
      process.exit(1);
    }
  }

  const provider = new GeminiProvider(apiKey, model);

  try {
    // 1. Vision extraction
    console.log("\n📸 [1/2] Sending textbook image to Gemini Vision API...");
    const startTime = Date.now();
    const candidates = await provider.extractVocabularyFromImage(
      imageBuffer,
      mimeType,
    );
    const extractionDuration = Date.now() - startTime;

    console.log(`✅ Vision analysis completed in ${extractionDuration}ms.`);
    console.log(
      `📋 Detected ${candidates.length} intentionally marked candidate(s):`,
    );
    console.dir(candidates, { depth: null });

    if (candidates.length === 0) {
      console.log(
        "ℹ️  No marked vocabulary detected in this image. Try an image with highlighted or underlined words.",
      );
      return;
    }

    // 2. Vocabulary enrichment
    const sampleToEnrich = candidates.slice(0, 3).map((c) => ({
      id: c.id,
      word: c.word,
      context: c.context,
    }));

    console.log(
      `\n📚 [2/2] Enriching ${sampleToEnrich.length} candidate(s) with Uzbek translations and definitions...`,
    );
    const enrichStart = Date.now();
    const enriched = await provider.enrichVocabulary(sampleToEnrich);
    const enrichDuration = Date.now() - enrichStart;

    console.log(`✅ Enrichment completed in ${enrichDuration}ms.`);
    console.log("📝 Enriched learning metadata:");
    console.dir(enriched, { depth: null });

    console.log("\n🎉 Live Google Gemini smoke test passed successfully!");
  } catch (error) {
    console.error("\n❌ Live Gemini smoke test failed:", error);
    process.exit(1);
  }
}

main();
