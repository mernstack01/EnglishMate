import { expect, type Browser, type Page } from "@playwright/test";
import path from "node:path";
import { Types } from "mongoose";
import { VocabularyWord } from "../src/models/vocabulary-word";
import { VocabularyReview } from "../src/models/vocabulary-review";

const origin = "http://localhost:3107";

export async function checkAiImageImport({
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

  console.log("  ▶ Testing AI Image Import flow...");

  // 1. Navigate to Image Import page
  await page.goto(`${origin}/vocabulary/import/image`);
  await expect(page).toHaveURL(/\/vocabulary\/import\/image/);
  await expect(
    page.getByRole("heading", { name: /Import from textbook photo/i }),
  ).toBeVisible();

  // Verify tabs
  await expect(page.getByRole("link", { name: /Import JSON/i })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Import from Image/i }),
  ).toBeVisible();

  // 2. Upload sample textbook image fixture
  const fileInput = page.locator('input[type="file"][accept*="image"]').first();
  await fileInput.setInputFiles(fixturePath);

  // Verify image preview and controls appear
  await expect(page.getByText("sample-textbook.png")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Analyze image/i }),
  ).toBeVisible();

  // 3. Analyze image (Stage 1)
  await page.getByRole("button", { name: /Analyze image/i }).click();

  // Verify detected candidates appear
  await expect(page.getByText(/Detected vocabulary/i)).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText("appropriate", { exact: true })).toBeVisible();
  await expect(page.getByText("look after", { exact: true })).toBeVisible();

  // Verify marking badges
  await expect(page.getByText("Highlighted").first()).toBeVisible();
  await expect(page.getByText("Underlined").first()).toBeVisible();

  // 4. Deselect one candidate (e.g. uncheck "maybe")
  const maybeCheckbox = page.locator(
    'input[type="checkbox"][aria-label*="maybe"]',
  );
  if (await maybeCheckbox.isVisible()) {
    await maybeCheckbox.uncheck();
  }

  // 5. Prepare vocabulary (Stage 2 Enrichment)
  const prepareBtn = page.getByRole("button", { name: /Prepare vocabulary/i });
  await expect(prepareBtn).toBeVisible();
  await prepareBtn.click();

  // 6. Review & Edit enrichment preview
  await expect(page.getByText(/Review & edit vocabulary/i)).toBeVisible({
    timeout: 10000,
  });
  const translationInput = page.locator('input[value="mos, munosib"]').first();
  await expect(translationInput).toBeVisible();

  // Edit translation of first item
  await translationInput.fill("mos, juda munosib");

  // 7. Confirm import
  await page.getByRole("button", { name: /Confirm import/i }).click();

  // 8. Import complete screen
  await expect(page.getByText(/Import complete!/i)).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText(/words added/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Start Learning/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Open Vocabulary/i }),
  ).toBeVisible();

  // 9. Verify in database: words saved with source = "IMAGE", status = "NEW"
  const importedWord = await VocabularyWord.findOne({
    userId: owner,
    normalizedWord: "appropriate",
  }).lean();

  if (!importedWord) {
    throw new Error("Imported word 'appropriate' not found in database");
  }
  expect(importedWord.source).toBe("IMAGE");
  expect(importedWord.status).toBe("NEW");
  expect(importedWord.translation).toBe("mos, juda munosib");

  // 10. Verify canonical VocabularyReview initialized
  const review = await VocabularyReview.findOne({
    userId: owner,
    vocabularyWordId: importedWord._id,
  }).lean();

  if (!review) {
    throw new Error(
      "VocabularyReview was not initialized for image imported word",
    );
  }
  expect(review.repetitions).toBe(0);

  // 11. Test manual word "Fill with AI"
  console.log("  ▶ Testing manual 'Fill with AI' on /vocabulary/new...");
  await page.goto(`${origin}/vocabulary/new`);

  // First test duplicate warning for an already imported word
  await page.getByLabel("Word or phrase").fill("essential");
  const fillWithAiBtn = page.getByRole("button", { name: /Fill with AI/i });
  await expect(fillWithAiBtn).toBeVisible();
  await fillWithAiBtn.click();

  await expect(
    page.getByText(/already exists in your notebook/i),
  ).toBeVisible();

  // Next test autofill with a new word
  await page.getByLabel("Word or phrase").fill("curious");
  await page.getByLabel("Translation", { exact: true }).fill("");
  await fillWithAiBtn.click();

  // Verify form is populated and success message appears
  await expect(page.getByLabel("Translation", { exact: true })).not.toHaveValue(
    "",
  );
  await expect(page.getByText(/AI filled learning details/i)).toBeVisible();

  // Save the autofilled word
  await page.getByRole("button", { name: /Save and view/i }).click();
  await expect(page).toHaveURL(/\/vocabulary\/[a-f\d]{24}/);

  const manualWord = await VocabularyWord.findOne({
    userId: owner,
    normalizedWord: "curious",
  }).lean();
  if (!manualWord) {
    throw new Error("Manual word with AI autofill not found");
  }
  expect(manualWord.source).toBe("MANUAL");

  console.log("PASS AI Image Import and manual Fill with AI E2E flow");
}
