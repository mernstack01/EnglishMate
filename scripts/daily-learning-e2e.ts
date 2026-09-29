import { expect, type Page } from "@playwright/test";

const origin = "http://localhost:3107";

export async function checkDailyMixedLearning({ page }: { page: Page }) {
  console.log(
    "  ▶ Testing Daily Mixed Commute Learning & Question Runner E2E flow...",
  );

  await page.setViewportSize({ width: 1440, height: 1000 });

  // 1. Visit /learn/today
  await page.goto(`${origin}/learn/today`);
  await expect(
    page.getByRole("heading", { name: "Today’s Learning", exact: false }),
  ).toBeVisible();

  // Verify plan contains planned questions
  await expect(page.getByText(/Questions Planned/i)).toBeVisible();

  // 2. Click Start Learning
  const startBtn = page
    .getByRole("button", {
      name: /Start Today's Learning|Start Today's Session|Continue Session|Start Practice/i,
    })
    .first();
  await expect(startBtn).toBeVisible();
  await startBtn.click();

  // Wait for runner navigation
  await expect(page).toHaveURL(/\/learn\/today\/practice/);

  // 3. Verify Question Card UI
  await expect(
    page.getByText(/Today's Plan|Mistakes Review/i).first(),
  ).toBeVisible();
  await expect(page.getByText(/Question \d+ of \d+/i)).toBeVisible();

  // 4. Step through questions and verify Grammar rendering
  let maxSteps = 120;
  let encounteredGrammar = false;

  while (maxSteps-- > 0) {
    // Check if session completed
    const completeHeader = page.getByRole("heading", {
      name: /Today's Learning Complete|Mistakes Practice Complete/i,
    });
    if (await completeHeader.isVisible().catch(() => false)) {
      break;
    }

    // If feedback is shown with a "Continue" button (incorrect answer)
    const continueBtn = page.getByRole("button", { name: /Continue/i });
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
      await expect(continueBtn)
        .toBeHidden({ timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(200);
      continue;
    }

    // Check prompt is present and never the literal string "MULTIPLE_CHOICE"
    const promptLocator = page.locator("h2").first();
    if (await promptLocator.isVisible().catch(() => false)) {
      const promptText = (await promptLocator.innerText()).trim();
      expect(promptText).not.toBe("MULTIPLE_CHOICE");
      expect(promptText.length).toBeGreaterThan(0);
    }

    // If Grammar module, record
    const isGrammar = await page
      .getByText(/GRAMMAR/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (isGrammar) {
      encounteredGrammar = true;
    }

    // If options are present
    const enabledOption = page
      .locator('[data-testid="daily-option-button"]:not([disabled])')
      .first();
    if (await enabledOption.isVisible().catch(() => false)) {
      await enabledOption.click();
      const feedbackContinue = page.getByRole("button", { name: /Continue/i });
      if (
        await feedbackContinue.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        await feedbackContinue.click();
        await expect(feedbackContinue)
          .toBeHidden({ timeout: 5000 })
          .catch(() => {});
      } else {
        await page.waitForTimeout(1000);
      }
      await page.waitForTimeout(200);
      continue;
    }

    const textInput = page.locator(
      'input[placeholder*="Type"]:not([disabled])',
    );
    if (await textInput.isVisible().catch(() => false)) {
      await textInput.fill("could");
      await page.getByRole("button", { name: /Submit Answer/i }).click();
      const feedbackContinue = page.getByRole("button", { name: /Continue/i });
      if (
        await feedbackContinue.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        await feedbackContinue.click();
        await expect(feedbackContinue)
          .toBeHidden({ timeout: 5000 })
          .catch(() => {});
      } else {
        await page.waitForTimeout(1000);
      }
      await page.waitForTimeout(200);
      continue;
    }

    await page.waitForTimeout(300);
  }

  // 5. Verify completion screen
  await expect(
    page.getByRole("heading", {
      name: /Today's Learning Complete|Mistakes Practice Complete/i,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Day Streak/i)).toBeVisible();
  await expect(page.getByText(/Accuracy/i).first()).toBeVisible();
  await expect(page.getByText(/Module Performance/i)).toBeVisible();

  expect(encounteredGrammar).toBe(true);

  console.log(
    "PASS Daily Mixed Commute Learning: Grammar rendering, retry flow, and session completion",
  );
}
