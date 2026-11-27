import AxeBuilder from "@axe-core/playwright";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test, type BrowserContext } from "@playwright/test";

import {
  chooseTheme,
  fillLoanForm,
  fillSignIn,
  getContrastPair,
  getControlBoundaryContrast,
  contrastRatio,
  signIn,
  signInOnly,
  signOut,
  unique,
  watchBrowserErrors,
} from "./support";

test("language preference and session persist across reloads", async ({
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
  await signOut(page, "es");
  await expect(
    page.getByRole("heading", { name: "Inicia sesión en Budgify" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("currency display converts values and persists independently per workspace", async ({
  page,
}) => {
  await page.route("https://open.er-api.com/v6/latest/**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        result: "success",
        rates: { COP: 4000, USD: 0.00025 },
      }),
    });
  });
  await signIn(page);
  const currency = page.getByRole("combobox", { name: "Currency" });
  await expect(currency).toHaveValue("USD");
  const beforeConversion = await page.locator(".hero-details").innerText();
  await currency.selectOption("COP");
  await expect(currency).toHaveValue("COP");
  await expect(
    page.locator(".eyebrow").filter({ hasText: "COP" }).first(),
  ).toBeVisible();
  await expect
    .poll(async () => page.locator(".hero-details").innerText())
    .not.toBe(beforeConversion);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Currency" })).toHaveValue(
    "COP",
  );

  await page
    .getByRole("combobox", { name: "Workspace" })
    .selectOption("business");
  await expect(page.getByRole("combobox", { name: "Currency" })).toHaveValue(
    "COP",
  );
  await page.getByRole("combobox", { name: "Currency" }).selectOption("USD");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Workspace" })).toHaveValue(
    "business",
  );
  await expect(page.getByRole("combobox", { name: "Currency" })).toHaveValue(
    "USD",
  );

  await page
    .getByRole("combobox", { name: "Workspace" })
    .selectOption("personal");
  await expect(page.getByRole("combobox", { name: "Currency" })).toHaveValue(
    "COP",
  );
});

test("exports converted schedules and preserves base amounts after editing", async ({
  page,
}) => {
  await page.route("https://open.er-api.com/v6/latest/**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ result: "success", rates: { COP: 4000 } }),
    });
  });
  await signIn(page);
  await page.getByRole("link", { name: "Reports" }).click();

  async function downloadCsv() {
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download amortization CSV" })
      .click();
    const download = await downloadPromise;
    const path = await download.path();
    return (await readFile(path, "utf8")).replace(/^\uFEFF/, "");
  }

  const base = await downloadCsv();
  await page.getByRole("combobox", { name: "Currency" }).selectOption("COP");
  const convertedPrincipal = await page.evaluate(() =>
    new Intl.NumberFormat("en-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(32_800_000),
  );
  await expect(page.locator(".print-summary")).toContainText(
    convertedPrincipal,
  );
  const converted = await downloadCsv();
  expect(converted.split("\r\n")[0]).toContain("Payment (COP)");
  const baseColumns = base.split("\r\n")[1].split('","');
  const convertedColumns = converted.split("\r\n")[1].split('","');
  for (const index of [4, 5, 6, 7, 9]) {
    expect(Number(convertedColumns[index].replaceAll('"', ""))).toBe(
      Math.round(Number(baseColumns[index].replaceAll('"', "")) * 4000),
    );
  }

  await page.getByRole("link", { name: "Loans & Installments" }).click();
  const loan = page.getByRole("row").filter({ hasText: "Grocery installment" });
  await loan.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Loan name").fill("Renamed grocery");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Renamed grocery" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Currency" }).selectOption("USD");
  await page
    .getByRole("row")
    .filter({ hasText: "Renamed grocery" })
    .getByRole("button", { name: "Edit" })
    .click();
  await expect(page.getByLabel("Principal")).toHaveValue("2700.00");
});

test("exports base currency when a display conversion is unavailable", async ({
  page,
}) => {
  await page.route("https://open.er-api.com/v6/latest/**", async (route) => {
    await route.fulfill({ status: 503 });
  });
  await signIn(page);
  await page.getByRole("combobox", { name: "Currency" }).selectOption("COP");
  await expect(
    page.getByText(
      "Conversion is unavailable until an exchange rate can be fetched.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page.locator(".print-summary")).toContainText("USD");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download amortization CSV" }).click();
  const download = await downloadPromise;
  const csv = await readFile(await download.path(), "utf8");
  expect(csv.split("\r\n")[0]).toContain("Payment (USD)");
});

test("sign-out keeps Personal data until a confirmed reset", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page);
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await page.getByRole("button", { name: "Add loan" }).click();
  await fillLoanForm(page, "Saved personal loan");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Saved personal loan" }),
  ).toBeVisible();
  await signOut(page);
  await expect(
    page.getByRole("heading", { name: "Sign in to Budgify" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Email")).toBeVisible();
  await fillSignIn(page);
  await expect(
    page.getByRole("row").filter({ hasText: "Saved personal loan" }),
  ).toBeVisible();

  let resetWarning = "";
  page.once("dialog", async (dialog) => {
    resetWarning = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "Reset sample data" }).click();
  expect(resetWarning).toContain("Small Business data is not affected");
  await expect(
    page.getByRole("row").filter({ hasText: "Saved personal loan" }),
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset sample data" }).click();
  await expect(page.getByLabel("Region")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Region")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Saved personal loan" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("row").filter({ hasText: "Grocery installment" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("memory-only mode warns when the workspace is chosen", async ({
  page,
}) => {
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
  await signInOnly(page);
  await expect(
    page.getByRole("status").filter({ hasText: "Memory-only mode" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Memory-only mode" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Email")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a failed setup write is reported without opening the app", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signInOnly(page);
  await expect(page.getByLabel("Region")).toBeVisible();
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Your change could not be saved",
  );
  await expect(
    page.getByRole("heading", { name: "Welcome to Budgify" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Region")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the session and Personal data survive a browser restart", async ({
  browserName,
  baseURL,
}) => {
  test.skip(
    browserName !== "chromium",
    "Persistent Chromium profile covers browser restart.",
  );
  if (!baseURL) throw new Error("A base URL is required.");
  const directory = await mkdtemp(join(tmpdir(), "budgify-profile-"));
  const options = {
    headless: true,
    baseURL,
    channel: process.env.PLAYWRIGHT_USE_CHROME ? "chrome" : undefined,
  };
  let context: BrowserContext | undefined;
  try {
    context = await chromium.launchPersistentContext(directory, options);
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

    context = await chromium.launchPersistentContext(directory, options);
    const reopened = await context.newPage();
    const reopenedErrors = watchBrowserErrors(reopened);
    await reopened.goto("/");
    await expect(
      reopened.getByRole("heading", { name: "Your money, in motion." }),
    ).toBeVisible();
    await expect(
      reopened.getByText("Ana Test,", { exact: false }),
    ).toBeVisible();
    await reopened.getByRole("link", { name: "Loans & Installments" }).click();
    await expect(
      reopened.getByRole("row").filter({ hasText: "Restart saved loan" }),
    ).toBeVisible();
    await signOut(reopened);
    await expect(reopened.getByLabel("Email")).toBeVisible();
    expect(reopenedErrors).toEqual([]);
    await context.close();
    context = undefined;

    context = await chromium.launchPersistentContext(directory, options);
    const signedOut = await context.newPage();
    const signedOutErrors = watchBrowserErrors(signedOut);
    await signedOut.goto("/");
    await expect(signedOut.getByLabel("Email")).toBeVisible();
    await fillSignIn(signedOut);
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

test("a schema-4 profile is migrated, keeping Personal data and a backup", async ({
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
          data: Record<string, unknown>;
        };
        record.schemaVersion = 4;
        record.data.schemaVersion = 4;
        record.data.userName = "Alex";
        record.data.isSignedIn = true;
        record.data.hasSignedIn = true;
        delete record.data.hasChosenWorkspace;
        store.put(JSON.stringify(record), "budgify-state");
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  });

  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Legacy saved loan" }),
  ).toBeVisible();
  const readBackup = () =>
    page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("budgify");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const value = await new Promise<unknown>((resolve, reject) => {
        const request = database
          .transaction("records")
          .objectStore("records")
          .get("budgify-state-backup-v4");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return value;
    });
  expect(await readBackup()).toContain("Alex");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset sample data" }).click();
  await expect(page.getByLabel("Region")).toBeVisible();
  expect(await readBackup()).toBeUndefined();
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
  await page.getByLabel("Search loans", { exact: true }).fill("E2E Grocery");
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
  const name = `Fourth business loan ${unique()}`;
  await signIn(page, "business", "CO");
  await expect(page.getByRole("combobox", { name: "Currency" })).toHaveValue(
    "COP",
  );
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await page.getByRole("button", { name: "Add loan" }).click();
  await fillLoanForm(page, name, "90000");
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
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Added by Ana Test");
  await page.reload();
  await expect(row).toBeVisible();
  expect(errors).toEqual([]);
});

test("Personal data stays in the browser and never reaches the API", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/") && request.method() !== "GET")
      writes.push(`${request.method()} ${request.url()}`);
  });
  const name = `Personal only ${unique()}`;
  await signIn(page);
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await page.getByRole("button", { name: "Add loan" }).click();
  await fillLoanForm(page, name);
  await page.getByRole("button", { name: "Save" }).click();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await page.reload();
  await expect(row).toBeVisible();
  expect(writes).toEqual([]);
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
  await signInOnly(page, { freezeTime: false });
  await expect(
    page.getByRole("heading", { name: "Welcome to Budgify" }),
  ).toBeVisible();
  const setupResults = await new AxeBuilder({ page }).analyze();
  expect(setupResults.violations, "workspace choice").toEqual([]);
  await page.getByRole("button", { name: "Continue" }).click();
  await chooseTheme(page, "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const bodyContrast = await getContrastPair(page, "body");
  expect(contrastRatio(...bodyContrast)).toBeGreaterThanOrEqual(4.5);
  const navContrast = await getContrastPair(
    page,
    '.navigation-rail nav a[aria-current="page"]',
  );
  expect(contrastRatio(...navContrast)).toBeGreaterThanOrEqual(4.5);

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
    if (screen.name === "loans") {
      expect(
        await getControlBoundaryContrast(
          page,
          ".search-field input",
          ".table-section",
        ),
      ).toBeGreaterThanOrEqual(3);
      await page.getByRole("button", { name: "Add loan" }).click();
      expect(
        await getControlBoundaryContrast(page, ".field input", ".dialog"),
      ).toBeGreaterThanOrEqual(3);
      const fieldContrast = await getContrastPair(page, ".field input");
      expect(contrastRatio(...fieldContrast)).toBeGreaterThanOrEqual(4.5);
      const primaryButtonContrast = await getContrastPair(
        page,
        ".dialog .button.primary",
      );
      expect(contrastRatio(...primaryButtonContrast)).toBeGreaterThanOrEqual(3);
      const dialogResults = await new AxeBuilder({ page }).analyze();
      expect(dialogResults.violations, "loans dialog").toEqual([]);
      await page.getByRole("button", { name: "Cancel" }).click();
    }
  }
  expect(errors).toEqual([]);
});

test("captures dashboard and loans in both themes", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const screenshotPath = (name: string) =>
    join(process.cwd(), "docs", "changes", "dark-mode", name);

  await page.screenshot({
    path: screenshotPath("dashboard-light.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await expect(
    page.getByRole("heading", { name: "Loans & Installments" }),
  ).toBeVisible();
  await page.screenshot({
    path: screenshotPath("loans-light.png"),
    fullPage: true,
  });
  await chooseTheme(page, "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: screenshotPath("loans-dark.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "Your money, in motion." }),
  ).toBeVisible();
  await page.screenshot({
    path: screenshotPath("dashboard-dark.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page.locator(".print-summary")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  const printStyles = await page
    .locator(".print-summary")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        color: style.color,
      };
    });
  expect(printStyles).toEqual({
    background: "rgb(255, 255, 255)",
    color: "rgb(7, 59, 76)",
  });
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
  await page.getByLabel("Search", { exact: true }).fill("E2E consulting");
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
  await chooseTheme(page, "Oscuro", "es");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const width of [320, 340, 360, 375, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(
      scrollWidth,
      `horizontal overflow at ${width}px`,
    ).toBeLessThanOrEqual(width);
    if (width <= 390) {
      for (const name of ["Espacio de trabajo", "Idioma"]) {
        const bounds = await page.getByRole("combobox", { name }).boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      }
      const avatar = await page
        .getByRole("button", { name: "Menú de la cuenta" })
        .boundingBox();
      expect(avatar).not.toBeNull();
      expect(avatar!.x + avatar!.width).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByRole("combobox", { name: "Idioma" }).selectOption("en");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset sample data" }).click();
  await expect(page.getByLabel("Region")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("link", { name: "Loans & Installments" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Grocery installment" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
