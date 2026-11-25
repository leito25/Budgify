import AxeBuilder from "@axe-core/playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";

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
  await expect(
    page.getByRole("heading", { name: "Your money, in motion." }),
  ).toBeVisible();
}

async function fillLoanForm(page: Page, name: string, principal = "90") {
  await page.locator("#loan-name").fill(name);
  await page.locator("#loan-principal").fill(principal);
  await page.locator("#loan-term").fill("3");
  await page.locator("#loan-rate").fill("0");
  await page.locator("#loan-first-due-date").fill("2026-12-15");
}

test("sign-in, language preference, and session persist without a password", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your money, in motion." }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Language" }).selectOption("es");
  await expect(
    page.getByRole("heading", { name: "Tu dinero, en movimiento." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Préstamos y cuotas" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Tu dinero, en movimiento." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByLabel("Tu nombre")).toHaveValue("Alex");
  await page.reload();
  await expect(page.getByLabel("Tu nombre")).toHaveValue("Alex");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("sign-out preserves the profile and data until a confirmed reset", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await page.getByRole("button", { name: "Add loan" }).click();
  await fillLoanForm(page, "Saved profile loan");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Saved profile loan" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Alex");
  await expect(page.getByLabel("Your name")).toHaveAttribute("readonly", "");
  await page.reload();
  await expect(page.getByLabel("Your name")).toHaveValue("Alex");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Saved profile loan" }),
  ).toBeVisible();

  let resetWarning = "";
  page.once("dialog", async (dialog) => {
    resetWarning = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Reset sample data" }).click();
  expect(resetWarning).toContain("name");
  await expect(
    page.getByRole("row").filter({ hasText: "Saved profile loan" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Alex");
  await page.getByRole("button", { name: "Continue" }).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset sample data" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("");
  await page.reload();
  await expect(page.getByLabel("Your name")).toHaveValue("");
  await page.getByLabel("Your name").fill("Morgan");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Saved profile loan" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("row").filter({ hasText: "Grocery installment" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("memory-only mode warns before and after sign-in", async ({ page }) => {
  const errors = watchBrowserErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("blocked");
      },
    });
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("status").filter({ hasText: "Memory-only mode" }),
  ).toBeVisible();
  await page.getByLabel("Your name").fill("Alex");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Memory-only mode" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Your name")).toHaveValue("");
  expect(errors).toEqual([]);
});

test("a failed profile write is reported without signing in", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await page.goto("/");
  await expect(page.getByLabel("Your name")).toBeVisible();
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.getByLabel("Your name").fill("Alex");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Your change could not be saved",
  );
  await expect(
    page.getByRole("heading", { name: "Welcome to Budgify" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Your name")).toHaveValue("");
  expect(errors).toEqual([]);
});

test("profile and data survive a browser restart", async ({
  browserName,
  baseURL,
}) => {
  test.skip(
    browserName !== "chromium",
    "Persistent Chromium profile covers browser restart.",
  );
  if (!baseURL) throw new Error("A base URL is required.");
  const directory = await mkdtemp(join(tmpdir(), "budgify-profile-"));
  let context: BrowserContext | undefined;
  try {
    context = await chromium.launchPersistentContext(directory, {
      headless: true,
      baseURL,
    });
    const page = await context.newPage();
    const firstErrors = watchBrowserErrors(page);
    await signIn(page);
    await page.getByRole("link", { name: "Loans & Installments" }).click();
    await page.getByRole("button", { name: "Add loan" }).click();
    await fillLoanForm(page, "Restart saved loan");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("row").filter({ hasText: "Restart saved loan" }),
    ).toBeVisible();
    expect(firstErrors).toEqual([]);
    await context.close();
    context = undefined;

    context = await chromium.launchPersistentContext(directory, {
      headless: true,
      baseURL,
    });
    const reopened = await context.newPage();
    const reopenedErrors = watchBrowserErrors(reopened);
    await reopened.goto("/");
    await expect(
      reopened.getByRole("heading", { name: "Your money, in motion." }),
    ).toBeVisible();
    await expect(reopened.getByText("Alex,", { exact: false })).toBeVisible();
    await reopened.getByRole("link", { name: "Loans & Installments" }).click();
    await expect(
      reopened.getByRole("row").filter({ hasText: "Restart saved loan" }),
    ).toBeVisible();
    await reopened.getByRole("button", { name: "Sign out" }).click();
    await expect(reopened.getByLabel("Your name")).toHaveValue("Alex");
    expect(reopenedErrors).toEqual([]);
    await context.close();
    context = undefined;

    context = await chromium.launchPersistentContext(directory, {
      headless: true,
      baseURL,
    });
    const signedOut = await context.newPage();
    const signedOutErrors = watchBrowserErrors(signedOut);
    await signedOut.goto("/");
    await expect(signedOut.getByLabel("Your name")).toHaveValue("Alex");
    await signedOut.getByRole("button", { name: "Continue" }).click();
    await signedOut.getByRole("link", { name: "Loans & Installments" }).click();
    await expect(
      signedOut.getByRole("row").filter({ hasText: "Restart saved loan" }),
    ).toBeVisible();
    expect(signedOutErrors).toEqual([]);
  } finally {
    if (context) await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("legacy signed-out data is preserved when a name is requested", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await page.getByRole("button", { name: "Add loan" }).click();
  await fillLoanForm(page, "Legacy saved loan");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Legacy saved loan" }),
  ).toBeVisible();

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("budgify");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("records", "readwrite");
      const store = transaction.objectStore("records");
      const request = store.get("budgify-state");
      request.onsuccess = () => {
        const record = JSON.parse(request.result) as {
          schemaVersion: number;
          data: {
            schemaVersion: number;
            userName: string | null;
            isSignedIn?: boolean;
          };
        };
        record.schemaVersion = 1;
        record.data.schemaVersion = 1;
        record.data.userName = null;
        delete record.data.isSignedIn;
        store.put(JSON.stringify(record), "budgify-state");
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  });

  await page.reload();
  await expect(page.getByLabel("Your name")).toHaveValue("");
  await page.getByLabel("Your name").fill("Alex");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Legacy saved loan" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset sample data" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("");
  const backup = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("budgify");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = database
        .transaction("records")
        .objectStore("records")
        .get("budgify-state-backup-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return value;
  });
  expect(backup).toBeUndefined();
  expect(errors).toEqual([]);
});

test("loan form validates, creates, searches, sorts, edits, and confirms deletion", async ({
  page,
}) => {
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
  const editedRow = page
    .getByRole("row")
    .filter({ hasText: "E2E Grocery edited" });
  await expect(editedRow).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(editedRow).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(editedRow).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Small Business blocks a fourth active loan until simulated upgrade", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page, "business", "CO");
  await expect(page.getByText("COP", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await page.getByRole("button", { name: "Add loan" }).click();
  await fillLoanForm(page, "Fourth business loan", "90000");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", {
      name: /Small Business has a three-active-loan limit/,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Accept simulated upgrade" }).click();
  await page
    .getByRole("dialog", { name: "Add loan" })
    .getByRole("button", { name: "Save" })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Fourth business loan" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Fourth business loan" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("Rate Helper shows workspace-specific reference rates and disclaimer", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await page.getByRole("button", { name: "Add loan" }).click();
  await page.getByRole("button", { name: "Rate Helper" }).click();
  await expect(
    page.getByText("Reference only, verify with your bank."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Credit-card accounts assessed interest/,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("combobox", { name: "Workspace" })
    .selectOption("business");
  await page.getByRole("button", { name: "Add loan" }).click();
  await page.getByRole("button", { name: "Rate Helper" }).click();
  await expect(
    page.getByRole("button", {
      name: /Consumer and ordinary credit reference/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Credit-card accounts assessed interest/,
    }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("loan dialog is keyboard operable and displays visible focus", async ({
  page,
}) => {
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

test("main screens have no automated accessibility violations", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome to Budgify" }),
  ).toBeVisible();
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
    if (screen.link)
      await page.getByRole("link", { name: screen.link }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, screen.name).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test("dashboard matches the planning board and exposes six monthly totals", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  const summaries = page.locator(".dashboard-grid > article");
  const first = await summaries.nth(0).boundingBox();
  const third = await summaries.nth(2).boundingBox();
  expect(first).not.toBeNull();
  expect(third).not.toBeNull();
  expect(Math.abs(first!.y - third!.y)).toBeLessThan(2);
  const payments = page.locator(".payment-row");
  const firstPayment = await payments.nth(0).boundingBox();
  const thirdPayment = await payments.nth(2).boundingBox();
  expect(firstPayment).not.toBeNull();
  expect(thirdPayment).not.toBeNull();
  expect(Math.abs(firstPayment!.y - thirdPayment!.y)).toBeLessThan(2);

  const details = page.locator(".timeline-details");
  await expect(details).not.toHaveAttribute("open");
  await details.locator("summary").focus();
  await page.keyboard.press("Enter");
  const rows = details.getByRole("row");
  await expect(rows).toHaveCount(7);
  await expect(rows.filter({ hasText: "2026-12" })).toContainText("$1,691.30");
  await expect(rows.filter({ hasText: "2027-04" })).toContainText("$750.80");
  await page.setViewportSize({ width: 375, height: 667 });
  const firstMobile = await summaries.nth(0).boundingBox();
  const thirdMobile = await summaries.nth(2).boundingBox();
  expect(firstMobile).not.toBeNull();
  expect(thirdMobile).not.toBeNull();
  expect(thirdMobile!.y).toBeGreaterThan(firstMobile!.y + firstMobile!.height);
  expect(errors).toEqual([]);
});

test("income CRUD keeps recurring and one-time amounts distinct", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("link", { name: "Income & Balance" }).click();
  const snapshotMetric = page
    .getByText("One-time income snapshot")
    .locator("..")
    .locator("strong");
  const recurringMetric = page
    .getByText("Monthly recurring income")
    .locator("..")
    .locator("strong");
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
  const editedRow = page
    .getByRole("row")
    .filter({ hasText: "E2E consulting edited" });
  await expect(editedRow).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(editedRow).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(editedRow).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("calendar payment updates status, dashboard, and report exports", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("link", { name: "Payment Calendar" }).click();
  const overdueRow = page
    .getByRole("row")
    .filter({ hasText: "Grocery installment" })
    .first();
  await expect(overdueRow).toContainText("Overdue");
  await overdueRow.getByRole("button", { name: "Mark paid in full" }).click();
  await expect(overdueRow).toContainText("Paid");
  await page.getByRole("link", { name: "Reports" }).click();
  await expect(
    page.getByRole("heading", { name: "Next five payments" }),
  ).toBeVisible();
  const downloadWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download amortization CSV" }).click();
  const download = await downloadWait;
  expect(download.suggestedFilename()).toContain("amortization.csv");
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printRequested = "true";
    };
  });
  await page.getByRole("button", { name: "Print one-page summary" }).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-print-requested",
    "true",
  );
  expect(errors).toEqual([]);
});

test("quest progress is deterministic, persists, and remains separate by mode", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page
    .getByRole("link", { name: "Financial Quest", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pay down high-interest debt" })
    .click();
  await expect(page.getByText("Month 2 of 6")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Month 2 of 6")).toBeVisible();
  for (let month = 0; month < 4; month += 1) {
    await page
      .getByRole("button", { name: "Build an emergency buffer" })
      .click();
    await expect(page.getByText(`Month ${month + 3} of 6`)).toBeVisible();
  }
  await expect(page.getByText("Month 6 of 6")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Workspace" })
    .selectOption("business");
  await page
    .getByRole("link", { name: "Financial Quest", exact: true })
    .click();
  await expect(page.getByText("Month 1 of 6")).toBeVisible();
  expect(errors).toEqual([]);
});

test("reset restores sample data and mobile layout has no horizontal overflow", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("combobox", { name: "Language" }).selectOption("es");
  for (const width of [375, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(
      scrollWidth,
      `horizontal overflow at ${width}px`,
    ).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByRole("combobox", { name: "Idioma" }).selectOption("en");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset sample data" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("");
  await page.getByLabel("Your name").fill("Alex");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Grocery installment" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
