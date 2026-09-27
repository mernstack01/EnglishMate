import { expect, type Page } from "@playwright/test";

const origin = "http://localhost:3107";

export async function checkGrammar({ page }: { page: Page }) {
  console.log(
    "  ▶ Testing Grammar Notebook, Exercises, JSON Import, Practice, and Mistakes E2E flow...",
  );

  // 1. Visit /grammar
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/grammar`);
  await expect(
    page.getByRole("heading", { name: "Grammar Notebook", exact: true }),
  ).toBeVisible();

  // 2. Click "New Topic"
  await page
    .getByRole("link", { name: /New Topic|Add Topic/i })
    .first()
    .click();
  await expect(page).toHaveURL(`${origin}/grammar/new`);

  // Fill in topic details: "Modal Verbs — Ability"
  await page.locator('input[name="title"]').fill("Modal Verbs — Ability");
  await page.locator('select[name="category"]').selectOption("MODAL_VERBS");
  await page
    .locator('input[name="description"]')
    .fill("Expressing ability with can, could, and be able to");
  await page
    .locator('textarea[name="content"]')
    .fill(
      "## Can\nUsed for present ability.\n\n## Could\nUsed for general past ability.\n\n## Be Able To\nUsed in other tenses.",
    );
  await page
    .locator('textarea[name="notes"]')
    .fill("Remember: 'could' is for general past ability.");

  // Save topic -> redirects to /grammar/[id]?saved=1
  await page.getByRole("button", { name: /Save topic/i }).click();
  await expect(page).toHaveURL(/\/grammar\/[a-f\d]{24}\?saved=1/);
  await expect(page.getByText(/Topic saved to your notebook/i)).toBeVisible();

  // Save topic URL for exercise additions
  const topicDetailsUrl = page.url().replace(/\?saved=1$/, "");

  // 3. Add Exercise #1: MULTIPLE_CHOICE
  await page
    .getByRole("link", { name: /Add Exercise|Add first exercise/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/grammar\/[a-f\d]{24}\/exercises\/new/);

  await page.locator('select[name="type"]').selectOption("MULTIPLE_CHOICE");
  await page
    .locator('textarea[name="question"]')
    .fill("My little sister _____ read when she was only four.");

  // Select "could" as correct answer (pre-populated options include "could")
  await page.locator('button:has-text("could")').first().click();

  await page
    .locator('textarea[name="explanation"]')
    .fill("'Could' is used to describe general ability in the past.");

  await page.getByRole("button", { name: /Save exercise/i }).click();
  await expect(page).toHaveURL(topicDetailsUrl);
  await expect(
    page.getByText("My little sister _____ read when she was only four."),
  ).toBeVisible();

  // 4. Add Exercise #2: FILL_BLANK
  await page
    .getByRole("link", { name: /Add Exercise/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/grammar\/[a-f\d]{24}\/exercises\/new/);

  await page.locator('select[name="type"]').selectOption("FILL_BLANK");
  await page
    .locator('textarea[name="question"]')
    .fill("She _____ speak English when she was five.");
  await page.locator('input[name="correctAnswer"]').fill("could");
  const acceptedInput = page.locator(
    'input[placeholder*="Add accepted variation"]',
  );
  if (await acceptedInput.isVisible()) {
    await acceptedInput.fill("managed to");
    await page.getByRole("button", { name: "Add", exact: true }).click();
  }
  await page
    .locator('textarea[name="explanation"]')
    .fill("The sentence describes past general ability.");

  await page
    .getByRole("button", { name: "Save exercise", exact: true })
    .click();
  await expect(page).toHaveURL(topicDetailsUrl);
  await expect(
    page.getByText("She _____ speak English when she was five."),
  ).toBeVisible();

  // 5. Test JSON Import on /grammar/import
  await page.goto(`${origin}/grammar/import`);
  await expect(
    page.getByRole("heading", { name: /Import Grammar Topics/i }),
  ).toBeVisible();

  const sampleJson = JSON.stringify({
    title: "Relative Clauses",
    category: "RELATIVE_CLAUSES",
    description: "Defining and non-defining clauses",
    content: "Use who for people and which for things.",
    exercises: [
      {
        type: "MULTIPLE_CHOICE",
        question: "The musician _____ wrote that song won a Grammy.",
        options: ["who", "which", "where"],
        correctAnswer: "who",
        explanation: "Use 'who' for people.",
      },
    ],
  });

  await page.locator("textarea#json").fill(sampleJson);
  await page.getByRole("button", { name: /Preview import/i }).click();

  await expect(page.getByText(/Ready: 1/i)).toBeVisible();
  await page.getByRole("button", { name: /Confirm & import/i }).click();
  await expect(page.getByText(/Import successful!/i)).toBeVisible();
  await page.getByRole("link", { name: /View topic & exercises/i }).click();
  await expect(page).toHaveURL(/\/grammar\/[a-f\d]{24}/);
  await expect(
    page.getByRole("heading", { name: "Relative Clauses", exact: true }),
  ).toBeVisible();

  // 6. Navigate to /learn and verify Grammar module card is present
  await page.goto(`${origin}/learn`);
  await expect(
    page.getByRole("heading", { name: /Today’s Review/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Grammar Practice", exact: true }),
  ).toBeVisible();

  // 7. Click into Grammar Learning Hub (/learn/grammar)
  await page.getByRole("link", { name: /Practice Grammar/i }).click();
  await expect(page).toHaveURL(`${origin}/learn/grammar`);
  await expect(
    page.getByRole("heading", { name: /Grammar Practice/i, level: 1 }),
  ).toBeVisible();

  // 8. Start practice on "Modal Verbs — Ability"
  await page
    .getByRole("button", {
      name: "Practice Modal Verbs — Ability",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(
    /\/learn\/grammar\/[a-f\d]{24}\/practice\?session=[a-f\d]{24}/,
  );

  // 9. Interactive Practice: Answer one question CORRECTLY and one INCORRECTLY
  await expect(page.getByText(/Question \d+ of \d+/i)).toBeVisible();

  // Question 1: Answer CORRECTLY
  // Check if it's multiple choice or fill blank
  const mcqOptionCould = page
    .getByRole("button", { name: /could/i, exact: false })
    .first();
  const fillInput = page.locator(
    'input[placeholder*="missing word"], input[placeholder*="answer"]',
  );

  if (await mcqOptionCould.isVisible()) {
    await mcqOptionCould.click();
  } else if (await fillInput.isVisible()) {
    await fillInput.fill("could");
    await page.getByRole("button", { name: /Check Answer/i }).click();
  }

  // Verify feedback is visible
  await expect(page.getByText(/Correct!|Not quite/i)).toBeVisible();
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.waitForTimeout(300);

  // Question 2: Answer INCORRECTLY to trigger wrong-answer reinsertion
  const currentFillInput = page.locator(
    'input[placeholder*="missing word"], input[placeholder*="answer"]',
  );
  const currentMcqOptions = page.locator("button:has(span.flex-1)");

  if (await currentFillInput.isVisible()) {
    await currentFillInput.fill("can"); // Intentional wrong answer
    await page.getByRole("button", { name: /Check Answer/i }).click();
  } else if ((await currentMcqOptions.count()) > 0) {
    // Click incorrect option
    const wrongOpt = page
      .getByRole("button", { name: /can$|will be able to/i })
      .first();
    if (await wrongOpt.isVisible()) {
      await wrongOpt.click();
    } else {
      await currentMcqOptions.first().click();
    }
  }

  // Verify Incorrect feedback & explanation shown
  await expect(page.getByText(/Not quite/i)).toBeVisible();
  await expect(page.getByText(/Correct answer/i)).toBeVisible();
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.waitForTimeout(300);

  // Continue remaining questions (including reinserted wrong question) until session complete
  let maxSteps = 10;
  while (maxSteps-- > 0) {
    if (await page.getByText(/Grammar Session Complete!/i).isVisible()) {
      break;
    }

    const continueBtn = page.getByRole("button", { name: /Continue/i });
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
      await page.waitForTimeout(200);
      continue;
    }

    const activeFill = page.locator(
      'input[placeholder*="missing word"], input[placeholder*="answer"]',
    );
    if (await activeFill.isVisible()) {
      await activeFill.fill("could");
      await page.getByRole("button", { name: /Check Answer/i }).click();
      await page.waitForTimeout(200);
      continue;
    }

    const optCould = page.getByRole("button", { name: /could/i }).first();
    if (await optCould.isVisible()) {
      await optCould.click();
      await page.waitForTimeout(200);
      continue;
    }

    const anyOption = page.locator("button:has(span.flex-1)").first();
    if (await anyOption.isVisible()) {
      await anyOption.click();
      await page.waitForTimeout(200);
      continue;
    }

    await page.waitForTimeout(200);
  }

  // 10. Verify Session Completion Screen
  await expect(page.getByText(/Grammar Session Complete!/i)).toBeVisible();
  await expect(page.getByText(/Accuracy/i)).toBeVisible();

  // 11. Verify Grammar Mistakes Page (/learn/grammar/mistakes)
  await page.goto(`${origin}/learn/grammar/mistakes`);
  await expect(
    page.getByRole("heading", { name: "Grammar Mistakes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Modal Verbs — Ability" }),
  ).toBeVisible();
  await expect(page.getByText(/Your answer:/i).first()).toBeVisible();
  await expect(page.getByText(/Correct:/i).first()).toBeVisible();

  // 12. Verify Dashboard shows updated streak and Grammar topics
  await page.goto(`${origin}/dashboard`);
  await expect(page.getByText("Grammar topics", { exact: true })).toBeVisible();

  // 13. Verify Progress Page (/progress) displays real Grammar stats
  await page.goto(`${origin}/progress`);
  await expect(
    page.getByRole("heading", { name: /Learning Progress/i }),
  ).toBeVisible();
  await expect(page.getByText(/Grammar Mastery/i)).toBeVisible();
  await expect(page.getByText(/Exercises Practiced/i)).toBeVisible();
  await expect(
    page.getByText("Grammar Accuracy", { exact: true }),
  ).toBeVisible();

  // 14. Mobile Responsive UX Checks (375x667 viewport)
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`${origin}/grammar`);
  await expect(
    page.getByRole("heading", { name: "Grammar Notebook", exact: true }),
  ).toBeVisible();
  await page.goto(`${origin}/grammar/new`);
  await expect(
    page.getByRole("heading", { name: "Add Grammar Topic", exact: true }),
  ).toBeVisible();
  await page.goto(`${origin}/learn/grammar`);
  await expect(
    page.getByRole("heading", { name: /Grammar Practice/i, level: 1 }),
  ).toBeVisible();
  await page.goto(`${origin}/learn/grammar/mistakes`);
  await expect(
    page.getByRole("heading", { name: "Grammar Mistakes", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });

  console.log(
    "PASS Grammar Notebook, Exercises, JSON Import, Practice, and Mistakes E2E flow",
  );
}
