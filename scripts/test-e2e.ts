import { checkVocabulary } from "./vocabulary-e2e";
import { checkLearning } from "./learning-e2e";
import { checkAiImageImport } from "./ai-import-e2e";
import { checkScanner } from "./scanner-e2e";
import { checkSynonyms } from "./synonyms-e2e";
import { checkGrammar } from "./grammar-e2e";
import { checkDailyMixedLearning } from "./daily-learning-e2e";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { chromium, expect } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { User } from "../src/models/user";
import { RateLimit } from "../src/models/rate-limit";
import { hashPassword } from "../src/lib/auth/password";

async function main() {
  const mongo = await MongoMemoryServer.create();
  let server: ReturnType<typeof spawn> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let logs = "";
  try {
    const uri = mongo.getUri("englishmate_e2e");
    await mongoose.connect(uri);
    await Promise.all([User.createIndexes(), RateLimit.createIndexes()]);
    const password = randomBytes(18).toString("base64url");
    const passwordHash = await hashPassword(password);
    await User.insertMany(
      Array.from({ length: 12 }, (_, i) => ({
        name: `Learner ${i}`,
        email: `learner${i}@example.test`,
        passwordHash,
      })),
    );
    const env = {
      ...process.env,
      MONGODB_URI: uri,
      AUTH_SECRET: randomBytes(32).toString("hex"),
      AUTH_URL: "http://localhost:3107",
      AUTH_TRUST_HOST: "true",
      APP_TIMEZONE: "Asia/Tashkent",
      AI_PROVIDER: "mock",
      PLAYWRIGHT_TEST: "1",
    };
    const seedEnv = {
      ...env,
      ADMIN_NAME: "Admin Tester",
      ADMIN_EMAIL: "admin@example.test",
      ADMIN_PASSWORD: password,
    };
    execFileSync(
      process.execPath,
      ["--import", "tsx", "scripts/seed-admin.ts"],
      { env: seedEnv },
    );
    const admin = await User.findOne({ email: "admin@example.test" }).select(
      "+passwordHash",
    );
    if (!admin) throw new Error("Admin seed failed");
    execFileSync(
      process.execPath,
      ["--import", "tsx", "scripts/seed-admin.ts"],
      { env: seedEnv },
    );
    expect(
      (await User.findById(admin._id).select("+passwordHash"))?.passwordHash,
    ).toBe(admin.passwordHash);
    console.log("PASS admin seed and idempotent rerun");
    server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "-p", "3107"],
      { env, stdio: ["ignore", "pipe", "pipe"] },
    );
    server.stdout?.on("data", (data) => {
      logs += String(data);
    });
    server.stderr?.on("data", (data) => {
      logs += String(data);
    });
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch("http://localhost:3107/login")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error(`Production server did not start: ${logs}`);
    browser = await chromium.launch(
      process.env.PLAYWRIGHT_CHROME === "1"
        ? { channel: "chrome", headless: true }
        : { headless: true },
    );
    const userContext = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    });
    const page = await userContext.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:3107/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("http://localhost:3107/admin/users");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("http://localhost:3107/register");
    await page.getByLabel("Your name").fill("Alice Learner");
    await page.getByLabel("Email address").fill("ALICE@example.test");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create your account" }).click();
    await expect(page).toHaveURL(/registered=1/);
    console.log("PASS registration and MongoDB connection");
    const alice = await User.findOne({ email: "alice@example.test" }).lean();
    expect(alice?.role).toBe("USER");
    expect(alice).not.toHaveProperty("passwordHash");
    try {
      await User.create({
        name: "Duplicate",
        email: "alice@example.test",
        passwordHash,
      });
      throw new Error("Duplicate accepted");
    } catch (error) {
      expect((error as { code: number }).code).toBe(11000);
    }
    await page.getByLabel("Email address").fill("alice@example.test");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /Hello, Alice/ }),
    ).toBeVisible();
    expect(
      await (
        await page.request.get("http://localhost:3107/api/auth/session")
      ).text(),
    ).not.toContain("passwordHash");
    console.log("PASS login, safe session, unique email index");
    mkdirSync("test-results", { recursive: true });
    await page.screenshot({
      path: "test-results/dashboard-desktop.png",
      fullPage: true,
    });
    await page.goto("http://localhost:3107/admin");
    await expect(page).toHaveURL(/\/dashboard/);
    console.log("PASS regular user rejected from administration");
    await page.goto("http://localhost:3107/settings");
    await page.getByLabel("Your name").fill("Alice Updated");
    await page.getByLabel("Preferred learning language").selectOption("UZ");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Your preferences are saved.",
    );
    const updated = await User.findById(alice!._id).lean();
    expect(updated?.name).toBe("Alice Updated");
    expect(updated?.preferredLanguage).toBe("UZ");
    console.log("PASS name and language settings persisted");
    await page
      .getByRole("button", { name: "Toggle light or dark theme" })
      .first()
      .click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.goto("http://localhost:3107/dashboard");
    await page.screenshot({
      path: "test-results/dashboard-dark.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/dashboard-mobile.png",
      fullPage: true,
    });
    await page.goto("http://localhost:3107/mistakes");
    await expect(
      page.getByRole("heading", { name: /Mistake Book/i }),
    ).toBeVisible();
    await page.goto("http://localhost:3107/progress");
    await expect(
      page.getByRole("heading", { name: /Learning Progress/i }),
    ).toBeVisible();
    console.log(
      "PASS theme persistence, mobile layout, all module empty states",
    );
    await checkVocabulary({
      browser,
      page,
      userId: alice!._id.toString(),
      password,
    });
    await checkAiImageImport({
      browser,
      page,
      userId: alice!._id.toString(),
      password,
    });
    await checkScanner({
      browser,
      page,
      userId: alice!._id.toString(),
      password,
    });
    await checkLearning({
      browser,
      page,
      userId: alice!._id.toString(),
      password,
    });
    await checkSynonyms({ page });
    await checkGrammar({ page });
    await checkDailyMixedLearning({ page });
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto("http://localhost:3107/login");
    await adminPage.getByLabel("Email address").fill("admin@example.test");
    await adminPage.getByLabel("Password", { exact: true }).fill(password);
    await adminPage
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(adminPage).toHaveURL(/dashboard/);
    await adminPage.goto("http://localhost:3107/admin");
    await expect(
      adminPage.getByText("Total users", { exact: true }),
    ).toBeVisible();
    await adminPage.goto("http://localhost:3107/admin/users");
    await adminPage.getByRole("link", { name: "Next" }).click();
    await expect(adminPage).toHaveURL(/page=2/);
    await adminPage
      .getByRole("textbox", { name: "Search users by name or email" })
      .fill("alice@example.test");
    await adminPage
      .getByRole("button", { name: "Search", exact: true })
      .click();
    await expect(
      adminPage.getByRole("cell", { name: /Alice Updated/ }),
    ).toBeVisible();
    adminPage.on("dialog", (dialog) => dialog.accept());
    await adminPage.locator('input[name="id"]').evaluate((input, id) => {
      (input as HTMLInputElement).value = id;
    }, admin._id.toString());
    await adminPage
      .getByRole("button", { name: "Deactivate", exact: true })
      .click();
    await expect(adminPage.locator("form [role=alert]")).toHaveText(
      "You cannot deactivate your own account.",
    );
    expect((await User.findById(admin._id))?.isActive).toBe(true);
    await adminPage.reload();
    console.log("PASS tampered self-deactivation rejected server-side");
    let unauthorizedChecked = false;
    await adminPage.route("**/admin/users**", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        await route.continue();
        return;
      }
      const response = await userContext.request.post(request.url(), {
        headers: {
          "next-action": request.headers()["next-action"],
          "content-type": request.headers()["content-type"],
          origin: "http://localhost:3107",
        },
        data: request.postDataBuffer()!,
        maxRedirects: 0,
      });
      expect(response.headers()["x-action-redirect"]).toContain("/dashboard");
      expect((await User.findById(alice!._id))?.isActive).toBe(true);
      unauthorizedChecked = true;
      await route.continue();
    });

    await adminPage
      .getByRole("button", { name: "Deactivate", exact: true })
      .click();
    await expect(
      adminPage.getByRole("button", { name: "Activate", exact: true }),
    ).toBeVisible();
    await adminPage.unroute("**/admin/users**");
    expect(unauthorizedChecked).toBe(true);
    console.log("PASS direct admin mutation rejected for regular user");
    await page.goto("http://localhost:3107/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Email address").fill("alice@example.test");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("form [role=alert]")).toContainText(
      "Unable to sign in",
    );
    await adminPage.getByLabel("Account status").selectOption("inactive");
    await adminPage
      .getByRole("button", { name: "Search", exact: true })
      .click();
    await expect(
      adminPage.getByRole("cell", { name: "Inactive", exact: true }),
    ).toBeVisible();
    await adminPage
      .getByRole("button", { name: "Activate", exact: true })
      .click();
    await expect(adminPage.getByText("No matching members.")).toBeVisible();
    await adminPage.goto(
      "http://localhost:3107/admin/users?q=admin%40example.test",
    );
    await expect(
      adminPage.getByText("Your account", { exact: true }),
    ).toBeVisible();
    expect(
      await adminPage
        .getByRole("button", { name: "Deactivate", exact: true })
        .count(),
    ).toBe(0);
    expect((await User.findById(admin._id))?.isActive).toBe(true);
    console.log(
      "PASS admin pagination, search, filtering, activation, deactivation and existing-session revocation",
    );
    await page.getByLabel("Email address").fill("alice@example.test");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/dashboard/);
    await page.goto("http://localhost:3107/settings");
    await page
      .getByRole("button", { name: "Sign out", exact: true })
      .last()
      .click();
    await expect(page).toHaveURL(/login/);
    await page.goto("http://localhost:3107/dashboard");
    await expect(page).toHaveURL(/login/);
    console.log("PASS reactivation and logout");
    expect(errors).toEqual([]);
    console.log("PASS no browser runtime errors");
    await adminContext.close();
    await userContext.close();
  } catch (error) {
    console.error(logs.slice(-5000));
    throw error;
  } finally {
    await browser?.close();
    server?.kill("SIGTERM");
    await mongoose.disconnect();
    await mongo.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
