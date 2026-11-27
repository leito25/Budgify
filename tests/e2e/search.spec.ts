import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn, watchBrowserErrors } from "./support";

const results = (page: Page) =>
  page.getByRole("listbox", { name: "Search results" }).getByRole("option");

const searchBox = (page: Page) =>
  page.getByRole("combobox", { name: "Search loans and income" });

test("part of a name finds a Small Business income entry in any case", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page, "business", "CO");
  for (const text of ["pan", "PAN", "Panadería", "PANADERÍA"]) {
    await searchBox(page).fill(text);
    const option = page.getByRole("option", {
      name: /Panadería seasonal order/,
    });
    await expect(option).toBeVisible();
    await expect(option).toContainText("Income");
  }
  expect(errors).toEqual([]);
});

test("a result opens its ledger with the record highlighted", async ({
  page,
}) => {
  await signIn(page, "business", "CO");
  await searchBox(page).fill("OVEN");
  await page.getByRole("option", { name: /Bakery oven/ }).click();
  await expect(
    page.getByRole("heading", { name: "Loans & Installments" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#loans\/business-bakery$/);
  const row = page.getByRole("row").filter({ hasText: "Bakery oven" });
  await expect(row).toHaveClass(/highlighted/);
  await expect(
    page.getByRole("row").filter({ hasText: "Coffee equipment" }),
  ).not.toHaveClass(/highlighted/);
});

test("the keyboard opens a result and a miss says so", async ({ page }) => {
  await signIn(page, "business", "CO");
  await searchBox(page).fill("zzzz");
  await expect(page.getByText("No loans or income match.")).toBeVisible();
  await searchBox(page).fill("sales");
  await expect(results(page)).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Income & Balance" }),
  ).toBeVisible();
  await expect(page.getByRole("row", { name: /Monthly sales/ })).toHaveClass(
    /highlighted/,
  );
});

test("Personal search runs on the local data", async ({ page }) => {
  await signIn(page);
  await searchBox(page).fill("MICRO");
  await expect(
    page.getByRole("option", { name: /Personal microloan/ }),
  ).toBeVisible();
  await page.getByRole("option", { name: /Personal microloan/ }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Personal microloan" }),
  ).toHaveClass(/highlighted/);
});

test("the search box works at the phone width and has no accessibility violations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await signIn(page, "business", "CO", { freezeTime: false });
  const box = searchBox(page);
  await box.fill("pan");
  await expect(results(page)).toBeVisible();
  const bounds = await box.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(375);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});
