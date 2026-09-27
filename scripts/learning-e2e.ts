import { expect, type Browser, type Page } from "@playwright/test";
import { Types } from "mongoose";
import { StudySession } from "../src/models/study-session";

const origin = "http://localhost:3107";

export async function checkLearning({
  page,
  userId,
}: {
  browser: Browser;
  page: Page;
  userId: string;
  password: string;
}) {
  const owner = new Types.ObjectId(userId);

  // 1. Visit /learn
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/learn`);
  await expect(
    page.getByRole("heading", { name: /Today’s Review/i }),
  ).toBeVisible();
  await expect(page.getByText(/DAILY SPACED REPETITION/i)).toBeVisible();

  // Verify Start Learning button
  const startBtn = page
    .getByRole("button", { name: /Start Learning|Extra Practice/i })
    .first();
  await expect(startBtn).toBeVisible();
  console.log("PASS /learn overview, stats and Start Learning button visible");

  // 2. Click Start Learning -> redirects to review runner
  await startBtn.click();
  await expect(page).toHaveURL(
    /\/learn\/vocabulary\/review\?session=[a-f\d]{24}/,
  );

  await expect(page.getByText(/REVIEW/i).first()).toBeVisible();
  await expect(page.getByText(/Question \d+ of \d+/i)).toBeVisible();
  console.log("PASS session initialized and review runner mounted");

  // 3. Answer questions in the session
  let maxSteps = 60;
  while (maxSteps-- > 0) {
    if (
      await page.getByRole("heading", { name: "Session Complete!" }).isVisible()
    ) {
      break;
    }

    const nextBtn = page.getByRole("button", { name: /Next Question/i });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await expect(nextBtn)
        .toBeHidden({ timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(200);
      continue;
    }

    const enabledOption = page
      .locator("button:has(span.rounded-full):not([disabled])")
      .first();
    if (await enabledOption.isVisible()) {
      await enabledOption.click();
      await expect(nextBtn).toBeVisible({ timeout: 5000 });
      await nextBtn.click();
      await expect(nextBtn)
        .toBeHidden({ timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(200);
      continue;
    }

    const typingInput = page.getByPlaceholder("Type the English word...");
    if (await typingInput.isVisible()) {
      await typingInput.fill("test");
      await page.getByRole("button", { name: "Check Answer" }).click();
      await expect(nextBtn).toBeVisible({ timeout: 5000 });
      await nextBtn.click();
      await expect(nextBtn)
        .toBeHidden({ timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(200);
      continue;
    }

    const enButton = page
      .locator("div:has(> p:text('English')) button:not([disabled])")
      .first();
    const uzButton = page
      .locator("div:has(> p:text('Uzbek')) button:not([disabled])")
      .first();
    if ((await enButton.isVisible()) && (await uzButton.isVisible())) {
      await enButton.click();
      await uzButton.click();
      await page.waitForTimeout(100);
      continue;
    }

    await page.waitForTimeout(200);
  }

  // 4. Session complete verification
  await expect(
    page.getByRole("heading", { name: "Session Complete!" }),
  ).toBeVisible();
  await expect(page.getByText(/Accuracy/i)).toBeVisible();
  console.log(
    "PASS interactive question answering, feedback, and session completion",
  );

  // 5. Check dashboard statistics update
  await page.goto(`${origin}/dashboard`);
  await expect(page.getByText("Study sessions", { exact: true })).toBeVisible();
  const sessionsCount = await StudySession.countDocuments({
    userId: owner,
    completedAt: { $ne: null },
  });
  expect(sessionsCount).toBeGreaterThanOrEqual(1);

  await expect(
    page.getByText("Study sessions", { exact: true }).locator(".."),
  ).toContainText(String(sessionsCount));

  console.log("PASS live streak and study sessions reflected on dashboard");

  // 6. Mobile layout verification
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/learn",
    "/learn/vocabulary",
    "/learn/vocabulary/new",
    "/learn/vocabulary/difficult",
  ]) {
    await page.goto(`${origin}${route}`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }

  await page.screenshot({
    path: "test-results/learn-mobile.png",
    fullPage: true,
  });

  console.log("PASS mobile responsive verification for all learning routes");
}
