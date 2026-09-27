import { expect, type Browser, type Page } from "@playwright/test";
import { Types } from "mongoose";
import { VocabularyWord } from "../src/models/vocabulary-word";
import { User } from "../src/models/user";
import { dateKey, dayRange } from "../src/lib/dates";
const origin = "http://localhost:3107";
export async function checkVocabulary({
  browser,
  page,
  userId,
  password,
}: {
  browser: Browser;
  page: Page;
  userId: string;
  password: string;
}) {
  const owner = new Types.ObjectId(userId);
  const bob = await User.findOne({ email: "learner0@example.test" });
  if (!bob) throw new Error("Missing second test user");
  await VocabularyWord.createIndexes();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/vocabulary/new`);
  await page.getByLabel("Word or phrase").fill(" Appropriate ");
  await page.getByLabel("Translation", { exact: true }).fill("mos, munosib");
  await page
    .locator('form:has(input[name="word"])')
    .evaluate((form, foreignId) => {
      for (const [name, value] of Object.entries({
        userId: foreignId,
        source: "AI",
        status: "LEARNED",
      })) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
    }, bob._id.toString());
  await page.getByRole("button", { name: "Save and view" }).click();
  await expect(page).toHaveURL(/\/vocabulary\/[a-f\d]{24}/);
  const original = await VocabularyWord.findOne({
    userId: owner,
    normalizedWord: "appropriate",
  }).lean();
  if (!original) throw new Error("Word not created for session owner");
  expect(original.status).toBe("NEW");
  expect(original.source).toBe("MANUAL");
  expect(original.review.repetitions).toBe(0);
  expect(original.review.nextReviewAt <= new Date()).toBe(true);
  await expect(page.getByLabel("Translation", { exact: true })).toHaveValue(
    "mos, munosib",
  );
  await page.goto(`${origin}/vocabulary/new`);
  await page.getByLabel("Word or phrase").fill("APPROPRIATE");
  await page.getByLabel("Translation", { exact: true }).fill("duplicate");
  await page.getByRole("button", { name: "Save and view" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText(
    "This word is already in your notebook.",
  );
  await page.getByLabel("Word or phrase").fill("litter");
  await page.getByLabel("Translation", { exact: true }).fill("axlat");
  await page.getByText("More details (optional)").click();
  await page.getByLabel("Example sentence").fill("Please do not drop litter.");
  await page.getByLabel("Part of speech").fill("noun");
  await page.getByLabel("Personal notes").fill("Seen in a park.");
  await page.getByRole("button", { name: "Save and add another" }).click();
  await expect(page.locator("form [role=status]")).toContainText("Word saved");
  await expect(page.getByLabel("Word or phrase")).toHaveValue("");
  const litter = await VocabularyWord.findOne({
    userId: owner,
    normalizedWord: "litter",
  }).lean();
  expect(litter?.example).toBe("Please do not drop litter.");
  console.log(
    "PASS vocabulary creation, optional details, save-another, review defaults and forged owner/source ignored",
  );

  const second = await browser.newContext();
  const bobPage = await second.newPage();
  await bobPage.goto(`${origin}/login`);
  await bobPage.getByLabel("Email address").fill(bob.email);
  await bobPage.getByLabel("Password", { exact: true }).fill(password);
  await bobPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(bobPage).toHaveURL(/dashboard/);
  await bobPage.goto(`${origin}/vocabulary/new`);
  await bobPage.getByLabel("Word or phrase").fill("appropriate");
  await bobPage
    .getByLabel("Translation", { exact: true })
    .fill("BOB PRIVATE TRANSLATION");
  await bobPage.getByRole("button", { name: "Save and view" }).click();
  await expect(bobPage).toHaveURL(/\/vocabulary\/[a-f\d]{24}/);
  const privateWord = await VocabularyWord.findOne({
    userId: bob._id,
    normalizedWord: "appropriate",
  }).lean();
  if (!privateWord) throw new Error("Second user's duplicate failed");
  await page.goto(`${origin}/vocabulary/${privateWord._id}`);
  await expect(
    page.getByRole("heading", { name: "Word not found." }),
  ).toBeVisible();
  expect(await page.content()).not.toContain("BOB PRIVATE TRANSLATION");
  await page.goto(`${origin}/vocabulary/${new Types.ObjectId()}`);
  await expect(
    page.getByRole("heading", { name: "Word not found." }),
  ).toBeVisible();
  await page.goto(`${origin}/vocabulary/${original._id}`);
  await page.getByLabel("Translation", { exact: true }).fill("STOLEN");
  await page
    .locator('form input[name="id"]')
    .first()
    .evaluate((input, id) => {
      (input as HTMLInputElement).value = id;
    }, privateWord._id.toString());
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("Word not found.");
  await page.reload();
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .locator('form input[name="id"]')
    .last()
    .evaluate((input, id) => {
      (input as HTMLInputElement).value = id;
    }, privateWord._id.toString());
  await page.getByRole("button", { name: "Delete word", exact: true }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("Word not found.");
  await page.goto(`${origin}/vocabulary`);
  const card = page.locator(`[data-word-id="${original._id}"]`);
  await card.locator('input[name="id"]').evaluate((input, id) => {
    (input as HTMLInputElement).value = id;
  }, privateWord._id.toString());
  await card.getByRole("button", { name: /difficult/i }).click();
  await expect(card.locator("[role=alert]")).toHaveText("Word not found.");
  const intact = await VocabularyWord.findById(privateWord._id).lean();
  expect(intact?.translation).toBe("BOB PRIVATE TRANSLATION");
  expect(intact?.status).toBe("NEW");
  expect(intact?.review).toBeDefined();
  await page.goto(`${origin}/vocabulary?q=BOB%20PRIVATE`);
  await expect(
    page.getByRole("heading", { name: "No words match these filters." }),
  ).toBeVisible();
  console.log(
    "PASS cross-user read/update/delete/status/search isolation; identical normalized words allowed for different users",
  );

  await page.goto(`${origin}/vocabulary/${original._id}`);
  await page.getByLabel("Word or phrase").fill(" APPROPRIATELY ");
  await page
    .getByLabel("Translation", { exact: true })
    .fill("munosib ravishda");
  await page.getByLabel("Learning status").selectOption("LEARNING");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("form [role=status]")).toHaveText("Changes saved.");
  expect((await VocabularyWord.findById(original._id))?.normalizedWord).toBe(
    "appropriately",
  );
  await page.getByLabel("Word or phrase").fill("LITTER");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText(
    "This word is already in your notebook.",
  );
  await page.goto(`${origin}/vocabulary?q=ravishda`);
  await expect(page.locator("article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Mark APPROPRIATELY difficult", exact: true })
    .click();
  await expect(page.locator("article [role=status]")).toHaveText(
    "Status updated.",
  );
  expect((await VocabularyWord.findById(original._id))?.status).toBe(
    "DIFFICULT",
  );
  await page.goto(`${origin}/vocabulary?status=DIFFICULT`);
  await expect(page.locator("article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Mark APPROPRIATELY learned", exact: true })
    .click();
  await expect(page.locator("article")).toHaveCount(0);
  expect((await VocabularyWord.findById(original._id))?.status).toBe("LEARNED");
  await page.goto(`${origin}/vocabulary/today`);
  await expect(page.locator("article")).toHaveCount(2);
  console.log(
    "PASS edit normalization, edit duplicates, translation search, quick statuses and today view",
  );

  await page.goto(`${origin}/vocabulary/import`);
  await page.getByLabel("Paste your JSON").fill("broken JSON");
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await expect(page.locator("form [role=alert]")).toContainText(
    "JSON is not valid",
  );
  const payload = [
    { word: "APPROPRIATELY", translation: "DO NOT OVERWRITE" },
    { word: "appropriately", translation: "duplicate" },
    {
      word: "participate",
      translation: "qatnashmoq",
      userId: bob._id.toString(),
    },
    { word: " PARTICIPATE ", translation: "duplicate" },
    { word: "missing translation" },
  ];
  await page.getByLabel("Paste your JSON").fill(JSON.stringify(payload));
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm import of 1 words" }),
  ).toBeVisible();
  expect(await VocabularyWord.countDocuments({ userId: owner })).toBe(2);
  await expect(
    page.getByText("Already exists — skipped", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Invalid — skipped", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm import of 1 words" }).click();
  await expect(page.getByRole("status")).toContainText(
    "1 words imported. 3 duplicates skipped. 1 invalid rows skipped.",
  );
  expect((await VocabularyWord.findById(original._id))?.translation).toBe(
    "munosib ravishda",
  );
  const imported = await VocabularyWord.findOne({
    userId: owner,
    normalizedWord: "participate",
  });
  expect(imported?.source).toBe("JSON");
  expect(imported?.review).toBeDefined();
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm import of 0 words" }),
  ).toBeDisabled();
  // Confirm must recheck duplicates even if the notebook changes after preview.
  await page
    .getByLabel("Paste your JSON")
    .fill(JSON.stringify([{ word: "race", translation: "incoming" }]));
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm import of 1 words" }),
  ).toBeVisible();
  await VocabularyWord.create({
    userId: owner,
    word: "race",
    translation: "existing value",
  });
  await page.getByRole("button", { name: "Confirm import of 1 words" }).click();
  await expect(page.getByRole("status")).toContainText(
    "0 words imported. 1 duplicates skipped.",
  );
  expect(
    (await VocabularyWord.findOne({ userId: owner, normalizedWord: "race" }))
      ?.translation,
  ).toBe("existing value");
  console.log(
    "PASS malformed JSON, preview without writes, invalid/existing/in-file duplicates, bulk import, review initialization and confirmation revalidation",
  );

  await VocabularyWord.create([
    {
      userId: owner,
      word: "before midnight",
      translation: "old date",
      createdAt: new Date("2026-09-15T18:59:59Z"),
    },
    {
      userId: owner,
      word: "after midnight",
      translation: "next date",
      createdAt: new Date("2026-09-15T19:00:00Z"),
    },
    {
      userId: bob._id,
      word: "private calendar",
      translation: "hidden",
      createdAt: new Date("2026-09-15T18:59:59Z"),
    },
  ]);
  await page.goto(
    `${origin}/vocabulary/calendar?month=2026-09&date=2026-09-15`,
  );
  await expect(
    page.getByRole("link", {
      name: "September 15, 2026: 1 words",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(1);
  await expect(
    page.locator("article").getByRole("heading", { name: "before midnight" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "September 16, 2026: 1 words", exact: true })
    .click();
  await expect(
    page.locator("article").getByRole("heading", { name: "after midnight" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Previous month", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "August 2026", exact: true }),
  ).toBeVisible();
  await page.goto(`${origin}/vocabulary?date=2026-09-15`);
  await expect(page.locator("article")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "September 15, 2026", exact: true }),
  ).toBeVisible();
  console.log(
    "PASS date grouping/filter and month aggregation at timezone boundary; foreign calendar data excluded",
  );

  await page.goto(`${origin}/vocabulary/import`);
  await page.getByLabel("Paste your JSON").fill(
    JSON.stringify(
      Array.from({ length: 23 }, (_, i) => ({
        word: `Paginate ${String(i).padStart(2, "0")}`,
        translation: "test batch",
      })),
    ),
  );
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm import of 23 words" })
    .click();
  await expect(page.getByRole("status")).toContainText("23 words imported.");
  await page.goto(`${origin}/vocabulary?q=Paginate&sort=az`);
  await expect(page.locator("article")).toHaveCount(20);
  await expect(page.locator("article").first().getByRole("heading")).toHaveText(
    "Paginate 00",
  );
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(3);
  await page.goto(`${origin}/vocabulary?q=Paginate&sort=za`);
  await expect(page.locator("article").first().getByRole("heading")).toHaveText(
    "Paginate 22",
  );
  await page.goto(`${origin}/vocabulary?sort=oldest`);
  await expect(page.locator("article").first().getByRole("heading")).toHaveText(
    "before midnight",
  );
  await page.goto(`${origin}/vocabulary?q=%5B`);
  await expect(page.locator("article")).toHaveCount(0);
  console.log(
    "PASS bulk pagination, A–Z/Z–A/oldest ordering and literal regex search",
  );

  await page.goto(`${origin}/vocabulary/${litter!._id}`);
  await page.getByRole("button", { name: "Delete word", exact: true }).click();
  await expect(page).toHaveURL(/deleted=1/);
  expect(await VocabularyWord.findById(litter!._id)).toBeNull();
  expect(
    await VocabularyWord.countDocuments({
      _id: litter!._id,
      "review.nextReviewAt": { $exists: true },
    }),
  ).toBe(0);
  const today = dayRange(dateKey(new Date(), "Asia/Tashkent"), "Asia/Tashkent");
  const total = await VocabularyWord.countDocuments({ userId: owner });
  const addedToday = await VocabularyWord.countDocuments({
    userId: owner,
    createdAt: today,
  });
  const due = await VocabularyWord.countDocuments({
    userId: owner,
    status: { $ne: "LEARNED" },
    "review.nextReviewAt": { $lte: new Date() },
  });
  await page.goto(`${origin}/dashboard`);
  await expect(
    page.getByText("Total vocabulary", { exact: true }).locator(".."),
  ).toContainText(String(total));
  await expect(
    page.getByText("New words today", { exact: true }).locator(".."),
  ).toContainText(String(addedToday));
  await expect(
    page.getByText("Vocabulary due", { exact: true }).locator(".."),
  ).toContainText(String(due));
  await page.goto(`${origin}/vocabulary`);
  await page.screenshot({
    path: "test-results/vocabulary-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/vocabulary-mobile.png",
    fullPage: true,
  });
  for (const route of [
    "/vocabulary",
    "/vocabulary/new",
    "/vocabulary/today",
    "/vocabulary/calendar",
    "/vocabulary/import",
    `/vocabulary/${original._id}`,
  ]) {
    await page.goto(`${origin}${route}`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto(
    `${origin}/vocabulary/calendar?month=2026-09&date=2026-09-15`,
  );
  await page.screenshot({
    path: "test-results/vocabulary-calendar-mobile.png",
    fullPage: true,
  });
  await second.close();
  console.log(
    "PASS atomic deletion of embedded review, live dashboard counts and all vocabulary routes at mobile width",
  );
}
