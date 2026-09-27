import { expect, type Page } from "@playwright/test";

const origin = "http://localhost:3107";

export async function checkSynonyms({ page }: { page: Page }) {
  console.log("  ▶ Testing Synonym Notebook and Learning E2E flow...");

  // 1. Visit /synonyms
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/synonyms`);
  await expect(
    page.getByRole("heading", { name: "Synonym Notebook", exact: true }),
  ).toBeVisible();

  // 2. Click "Add synonym group"
  await page
    .getByRole("link", { name: /Add synonym group|Add group/i })
    .first()
    .click();
  await expect(page).toHaveURL(`${origin}/synonyms/new`);

  // Fill in first group: "want to"
  await page.locator('input[name="term"]').fill("want to");
  await page.locator('input[name="meaning"]').fill("xohlamoq");

  // Add first synonym
  const synInput = page.locator('input[placeholder*="Type a synonym"]');
  await synInput.fill("would like to");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  // Add second synonym via Enter key
  await synInput.fill("wish to");
  await synInput.press("Enter");

  // Add third synonym
  await synInput.fill("intend to");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await page
    .locator('textarea[name="notes"]')
    .fill("Nuances of intention and desire");

  // Click Save & add another
  await page.getByRole("button", { name: /Save & add another/i }).click();
  await expect(page.getByText(/Synonym group saved/i)).toBeVisible();

  // 3. Create second group: "problem"
  await page.locator('input[name="term"]').fill("problem");
  await page.locator('input[name="meaning"]').fill("muammo");

  await synInput.fill("issue");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await synInput.fill("difficulty");
  await synInput.press("Enter");

  await synInput.fill("obstacle");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  // Click Save synonym group (redirects to /synonyms/[id]?saved=1)
  await page.getByRole("button", { name: /Save synonym group/i }).click();
  await expect(page).toHaveURL(/\/synonyms\/[a-f\d]{24}\?saved=1/);
  await expect(
    page.getByText(/Synonym group added to your notebook/i),
  ).toBeVisible();

  // 4. Return to /synonyms and verify both groups are visible
  await page.goto(`${origin}/synonyms`);
  await expect(page.getByRole("heading", { name: /WANT TO/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /PROBLEM/i })).toBeVisible();
  await expect(page.getByText(/would like to/i).first()).toBeVisible();
  await expect(page.getByText(/issue/i).first()).toBeVisible();

  // Quick status update: mark problem as Difficult
  const diffBtn = page.getByRole("button", { name: /Mark problem difficult/i });
  if (await diffBtn.isVisible()) {
    await diffBtn.click();
    await expect(page.getByText(/Status updated/i)).toBeVisible();
  }

  // 5. Test JSON Import on /synonyms/import
  await page.goto(`${origin}/synonyms/import`);
  await expect(
    page.getByRole("heading", { name: /Import Synonym Groups/i }),
  ).toBeVisible();

  const sampleJson = JSON.stringify([
    {
      term: "mostly",
      meaning: "asosan",
      synonyms: ["mainly", "generally", "primarily", "largely"],
    },
  ]);

  await page.locator('textarea[name="json"]').fill(sampleJson);
  await page.getByRole("button", { name: /Preview import/i }).click();

  await expect(page.getByText(/Ready: 1/i)).toBeVisible();
  await page.getByRole("button", { name: /Confirm & import/i }).click();
  await expect(page.getByText(/Import successful!/i)).toBeVisible();

  // 6. Navigate to /learn/synonyms
  await page.goto(`${origin}/learn/synonyms`);
  await expect(
    page.getByRole("heading", { name: /Synonym Learning/i }),
  ).toBeVisible();
  const startBtn = page
    .getByRole("button", { name: /Start Synonym Practice|Extra Practice/i })
    .first();
  await expect(startBtn).toBeVisible();

  // 7. Start Synonym Practice session
  await startBtn.click();
  await expect(page).toHaveURL(
    /\/learn\/synonyms\/review\?session=[a-f\d]{24}/,
  );

  // 8. Answer questions in the session
  let maxQuestions = 50;
  while (maxQuestions-- > 0) {
    if (await page.getByText(/Synonym Session Complete!/i).isVisible()) {
      break;
    }

    const continueBtn = page.getByRole("button", { name: /Continue/i });
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
      await page.waitForTimeout(200);
      continue;
    }

    // Check for typing input
    const typingInput = page.locator('input[placeholder*="Type any synonym"]');
    if (await typingInput.isVisible()) {
      await typingInput.fill("would like to");
      await page.getByRole("button", { name: /Check Answer/i }).click();
      await page.waitForTimeout(200);
      continue;
    }

    // Check for multi-answer submit button
    const multiSubmit = page.getByRole("button", { name: /Submit selection/i });
    if (await multiSubmit.isVisible()) {
      const optionBoxes = page.locator(
        "button:has(.stroke-\\[3\\], div.border)",
      );
      if ((await optionBoxes.count()) > 0) {
        await optionBoxes.first().click();
      }
      await multiSubmit.click();
      await page.waitForTimeout(200);
      continue;
    }

    // Check for Match game buttons
    const leftMatchBtn = page
      .locator("button[data-side='left']:not([disabled])")
      .first();
    if (await leftMatchBtn.isVisible()) {
      const pairId = await leftMatchBtn.getAttribute("data-pair");
      const rightMatchBtn = page.locator(
        `button[data-side='right'][data-pair='${pairId}']:not([disabled])`,
      );
      if (await rightMatchBtn.isVisible()) {
        await leftMatchBtn.click();
        await rightMatchBtn.click();
        await page.waitForTimeout(200);
        continue;
      }
    }

    // Check for Single Choice buttons (Recognition or Reverse Recognition)
    const options = page.locator("div.grid.gap-2\\.5 button");
    const optCount = await options.count();
    if (optCount >= 2) {
      await options.first().click();
      await page.waitForTimeout(200);
      continue;
    }

    await page.waitForTimeout(300);
  }

  // 9. Verify completion screen
  await expect(page.getByText(/Synonym Session Complete!/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Back to Synonym Learning/i }),
  ).toBeVisible();

  console.log("PASS Synonym Notebook and Learning E2E flow");
}
