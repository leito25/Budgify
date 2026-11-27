import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  fillSignIn,
  signIn,
  signOut,
  TEST_EMAIL,
  TEST_PASSWORD,
  watchBrowserErrors,
} from "./support";

const pages = [
  "",
  "#dashboard",
  "#loans",
  "#income",
  "#calendar",
  "#quest",
  "#reports",
];

test("every page shows only the sign-in screen when signed out", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  for (const hash of pages) {
    await page.goto(`/${hash}`);
    await expect(
      page.getByRole("heading", { name: "Sign in to Budgify" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("the API refuses every request without a sign-in", async ({ request }) => {
  for (const path of ["/api/me", "/api/workspace", "/api/search?q=a"])
    expect((await request.get(path)).status()).toBe(401);
  expect((await request.post("/api/loans", { data: {} })).status()).toBe(401);
});

test("a wrong password is refused with a text message", async ({ page }) => {
  await page.goto("/");
  await fillSignIn(page, TEST_EMAIL, "not-the-password");
  const alert = page.getByRole("alert");
  await expect(alert).toHaveText("The email or password is not correct.");
  await fillSignIn(page, "nobody@budgify.ng", TEST_PASSWORD);
  await expect(alert).toHaveText("The email or password is not correct.");
  await expect(
    page.getByRole("heading", { name: "Sign in to Budgify" }),
  ).toBeVisible();
});

test("the right password opens the app, and a reload keeps the session", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your money, in motion." }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Sign out returns to the sign-in screen", async ({ page }) => {
  await signIn(page);
  await signOut(page);
  await expect(
    page.getByRole("heading", { name: "Sign in to Budgify" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("the sign-in screen has no accessibility violations and a Sea Green button", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Email")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  const button = page.getByRole("button", { name: "Sign in" });
  await expect(button).toHaveCSS("background-color", "rgb(6, 214, 160)");
  await expect(button).toHaveCSS("color", "rgb(7, 59, 76)");
});

test("the sign-in screen works at the phone width without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await expect(page.getByLabel("Email")).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(320);
});
