import { expect, type Browser, type Page } from "@playwright/test";
import path from "node:path";
import { Types } from "mongoose";
import { VocabularyWord } from "../src/models/vocabulary-word";
import { VocabularyReview } from "../src/models/vocabulary-review";

const origin = "http://localhost:3107";

export async function checkScanner({
  page,
  userId,
}: {
  browser: Browser;
  page: Page;
  userId: string;
  password: string;
}) {
  const owner = new Types.ObjectId(userId);
  const fixturePath = path.join(
    process.cwd(),
    "tests",
    "fixtures",
    "sample-textbook.png",
  );

  console.log("  ▶ Testing Phase 8 Camera & Local Scanner E2E flow...");

  // 1. Start at Vocabulary notebook
  await page.goto(`${origin}/vocabulary`);
  await expect(page).toHaveURL(/\/vocabulary/);

  // 2. Verify "Scan Page" entry point in navigation
  const scanNavLink = page.getByRole("link", { name: /Scan Page/i }).first();
  await expect(scanNavLink).toBeVisible();
  await scanNavLink.click();

  // 3. Arrive at /vocabulary/scanner
  await expect(page).toHaveURL(/\/vocabulary\/scanner/);
  await expect(page.getByRole("heading", { name: "Scan Page" })).toBeVisible();

  // 4. Test mobile responsiveness at 390px (iPhone width)
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByText(/Local OCR processes the page on your device/i),
  ).toBeVisible();

  // 5. Inject deterministic OCR mock words into page window
  await page.evaluate(() => {
    (
      window as unknown as { __MOCK_OCR_WORDS__?: unknown[] }
    ).__MOCK_OCR_WORDS__ = [
      {
        text: "eloquent,",
        confidence: 96,
        bbox: { x0: 20, y0: 20, x1: 90, y1: 45 },
      },
      {
        text: "meticulous",
        confidence: 92,
        bbox: { x0: 100, y0: 20, x1: 170, y1: 45 },
      },
      {
        text: "ordinary",
        confidence: 89,
        bbox: { x0: 20, y0: 60, x1: 85, y1: 85 },
      },
    ];
  });

  // 6. Upload fixture image
  const fileInput = page.locator('input[type="file"][accept*="image"]').first();
  await fileInput.setInputFiles(fixturePath);

  // 7. Verify preview and controls appear
  await expect(page.getByRole("button", { name: /Scan Page/i })).toBeVisible();

  // 8. Click "Scan Page"
  await page.getByRole("button", { name: /Scan Page/i }).click();

  // 9. Review Screen appears with detected words
  await expect(page.getByText(/Review Detected Words/i)).toBeVisible({
    timeout: 10000,
  });

  // 10. Test toggling Detection Overlay
  const overlayBtn = page.getByRole("button", {
    name: /Show detection overlay/i,
  });
  if (await overlayBtn.isVisible()) {
    await overlayBtn.click();
    await expect(
      page.getByRole("button", { name: /Hide detection overlay/i }),
    ).toBeVisible();
  }

  // 11. Add a word manually in the review form
  const manualWordInput = page.getByPlaceholder(/Add word manually/i);
  await expect(manualWordInput).toBeVisible();
  await manualWordInput.fill("serendipity");

  const manualTransInput = page.getByPlaceholder(/Translation \(optional\)/i);
  await manualTransInput.fill("kutilmagan baxt");

  await page.getByRole("button", { name: "Add Word" }).click();
  await expect(page.getByText("serendipity")).toBeVisible();

  // 12. Verify sticky Import Selected button shows selected count and click it
  const importBtn = page.getByRole("button", { name: /Import Selected/i });
  await expect(importBtn).toBeVisible();
  await importBtn.click();

  // 13. Verify Import Summary Card
  await expect(page.getByText(/Import completed successfully!/i)).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText(/Imported:/i)).toBeVisible();

  // 14. Click "View in Vocabulary"
  const viewInVocabLink = page.getByRole("link", {
    name: /View in Vocabulary/i,
  });
  await expect(viewInVocabLink).toBeVisible();
  await viewInVocabLink.click();

  await expect(page).toHaveURL(/\/vocabulary/);

  // 15. Verify database persistence: word belongs to user, source is "IMAGE", review initialized
  const savedWord = await VocabularyWord.findOne({
    userId: owner,
    normalizedWord: "serendipity",
  }).lean();

  if (!savedWord) {
    throw new Error("Scanned imported word 'serendipity' not found in MongoDB");
  }

  expect(savedWord.source).toBe("IMAGE");
  expect(savedWord.status).toBe("NEW");
  expect(savedWord.translation).toBe("kutilmagan baxt");

  const reviewDoc = await VocabularyReview.findOne({
    userId: owner,
    vocabularyWordId: savedWord._id,
  }).lean();

  if (!reviewDoc) {
    throw new Error(
      "VocabularyReview was not initialized for scanned imported word",
    );
  }
  expect(reviewDoc.repetitions).toBe(0);

  // Restore desktop viewport
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log("PASS Phase 8 Camera & Local Scanner E2E flow");
}
