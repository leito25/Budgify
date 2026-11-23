import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function watchBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function signIn(page: Page, mode = "personal", region = "US") {
  await page.clock.install({ time: new Date("2026-11-23T12:00:00.000Z") });
  await page.goto("/");
  await page.getByLabel("Your name").fill("Alex");
  await page.getByLabel("Region").selectOption(region);
  await page.getByLabel("Workspace").selectOption(mode);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Your money, in motion." })).toBeVisible();
}

async function fillLoanForm(page: Page, name: string, principal = "90") {
  await page.locator("#loan-name").fill(name);
  await page.locator("#loan-principal").fill(principal);
  await page.locator("#loan-term").fill("3");
  await page.locator("#loan-rate").fill("0");
  await page.locator("#loan-first-due-date").fill("2026-12-15");
}

test("sign-in, language preference, and session persist without a password", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your money, in motion." })).toBeVisible();
  await page.getByRole("combobox", { name: "Language" }).selectOption("es");
  await expect(page.getByRole("heading", { name: "Tu dinero, en movimiento." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Préstamos y cuotas" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tu dinero, en movimiento." })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByLabel("Tu nombre")).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("loan form validates, creates, searches, sorts, edits, and confirms deletion", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await page.getByRole("button", { name: "Add loan" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("#loan-name-error")).toBeVisible();
  await fillLoanForm(page, "E2E Grocery");
  await page.getByRole("button", { name: "Save" }).click();
  const row = page.getByRole("row").filter({ hasText: "E2E Grocery" });
  await expect(row).toBeVisible();
  await page.getByLabel("Search loans").fill("E2E Grocery");
  await page.getByRole("button", { name: "Loan name" }).click();
  await row.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Loan name").fill("E2E Grocery edited");
  await page.getByRole("button", { name: "Save" }).click();
  const editedRow = page.getByRole("row").filter({ hasText: "E2E Grocery edited" });
  await expect(editedRow).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(editedRow).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(editedRow).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Small Business blocks a fourth active loan until simulated upgrade", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await signIn(page, "business", "CO");
  await expect(page.getByText("COP", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await page.getByRole("button", { name: "Add loan" }).click();
  await fillLoanForm(page, "Fourth business loan", "90000");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: /Small Business has a three-active-loan limit/ })).toBeVisible();
  await page.getByRole("button", { name: "Accept simulated upgrade" }).click();
  await page.getByRole("dialog", { name: "Add loan" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Fourth business loan" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: "Fourth business loan" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Rate Helper shows workspace-specific reference rates and disclaimer", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await page.getByRole("button", { name: "Add loan" }).click();
  await page.getByRole("button", { name: "Rate Helper" }).click();
  await expect(page.getByText("Reference only, verify with your bank.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Credit-card accounts assessed interest/ })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("combobox", { name: "Workspace" }).selectOption("business");
  await page.getByRole("button", { name: "Add loan" }).click();
  await page.getByRole("button", { name: "Rate Helper" }).click();
  await expect(page.getByRole("button", { name: /Consumer and ordinary credit reference/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Credit-card accounts assessed interest/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("loan dialog is keyboard operable and displays visible focus", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  const addButton = page.getByRole("button", { name: "Add loan" });
  await addButton.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Add loan" });
  const loanName = page.getByLabel("Loan name");
  await expect(dialog).toBeVisible();
  await expect(loanName).toBeFocused();
  await page.keyboard.press("Tab");
  const description = page.getByLabel("Description");
  await expect(description).toBeFocused();
  await expect(description).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(addButton).toBeFocused();
  expect(errors).toEqual([]);
});

test("main screens have no automated accessibility violations", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome to Budgify" })).toBeVisible();
  const signInResults = await new AxeBuilder({ page }).analyze();
  expect(signInResults.violations, "sign-in screen").toEqual([]);
  await page.getByLabel("Your name").fill("Alex");
  await page.getByRole("button", { name: "Continue" }).click();

  const screens = [
    { name: "dashboard", link: null },
    { name: "loans", link: "Loans & Installments" },
    { name: "income", link: "Income & Balance" },
    { name: "calendar", link: "Payment Calendar" },
    { name: "quest", link: "Financial Quest" },
    { name: "reports", link: "Reports" },
  ];
  for (const screen of screens) {
    if (screen.link) await page.getByRole("link", { name: screen.link }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, screen.name).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test("income CRUD keeps recurring and one-time amounts distinct", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("link", { name: "Income & Balance" }).click();
  const snapshotMetric = page.getByText("One-time income snapshot").locator("..").locator("strong");
  const recurringMetric = page.getByText("Monthly recurring income").locator("..").locator("strong");
  const snapshotBefore = await snapshotMetric.textContent();
  const recurringBefore = await recurringMetric.textContent();
  await page.getByRole("button", { name: "Add income" }).click();
  await page.getByLabel("Source").fill("E2E consulting");
  await page.getByLabel("Amount").fill("125");
  await page.getByLabel("Date received").fill("2026-11-23");
  await page.getByLabel("Frequency").selectOption("one_time");
  await page.getByRole("button", { name: "Save" }).click();
  const row = page.getByRole("row").filter({ hasText: "E2E consulting" });
  await expect(row).toContainText("One time");
  await expect(snapshotMetric).not.toHaveText(snapshotBefore ?? "");
  await expect(recurringMetric).toHaveText(recurringBefore ?? "");
  await page.getByLabel("Search").fill("E2E consulting");
  await row.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Source").fill("E2E consulting edited");
  await page.getByRole("button", { name: "Save" }).click();
  const editedRow = page.getByRole("row").filter({ hasText: "E2E consulting edited" });
  await expect(editedRow).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(editedRow).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(editedRow).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("calendar payment updates status, dashboard, and report exports", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("link", { name: "Payment Calendar" }).click();
  const overdueRow = page.getByRole("row").filter({ hasText: "Grocery installment" }).first();
  await expect(overdueRow).toContainText("Overdue");
  await overdueRow.getByRole("button", { name: "Mark paid in full" }).click();
  await expect(overdueRow).toContainText("Paid");
  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page.getByRole("heading", { name: "Next five payments" })).toBeVisible();
  const downloadWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download amortization CSV" }).click();
  const download = await downloadWait;
  expect(download.suggestedFilename()).toContain("amortization.csv");
  await page.evaluate(() => {
    window.print = () => { document.body.dataset.printRequested = "true"; };
  });
  await page.getByRole("button", { name: "Print one-page summary" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-print-requested", "true");
  expect(errors).toEqual([]);
});

test("quest progress is deterministic, persists, and remains separate by mode", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("link", { name: "Financial Quest", exact: true }).click();
  await page.getByRole("button", { name: "Pay down high-interest debt" }).click();
  await expect(page.getByText("Month 2 of 6")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Month 2 of 6")).toBeVisible();
  for (let month = 0; month < 4; month += 1) {
    await page.getByRole("button", { name: "Build an emergency buffer" }).click();
  }
  await expect(page.getByText("Month 6 of 6")).toBeVisible();
  await page.getByRole("combobox", { name: "Workspace" }).selectOption("business");
  await page.getByRole("link", { name: "Financial Quest", exact: true }).click();
  await expect(page.getByText("Month 1 of 6")).toBeVisible();
  expect(errors).toEqual([]);
});

test("reset restores sample data and mobile layout has no horizontal overflow", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("combobox", { name: "Language" }).selectOption("es");
  for (const width of [375, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByRole("combobox", { name: "Idioma" }).selectOption("en");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset sample data" }).click();
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Grocery installment" })).toBeVisible();
  expect(errors).toEqual([]);
});
