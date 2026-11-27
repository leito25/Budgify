import { expect, type Page } from "@playwright/test";

export const TEST_EMAIL = "ana@budgify.ng";
export const TEST_PASSWORD = "test-password";

export function watchBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** A short suffix, so tests sharing a project's server never collide on names. */
export function unique(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function fillSignIn(
  page: Page,
  email = TEST_EMAIL,
  password = TEST_PASSWORD,
) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/**
 * Signs in with the test account, up to the workspace choice. Time is frozen
 * at the test server's date; axe's own timers stall under a frozen clock,
 * so accessibility tests pass `{ freezeTime: false }`.
 */
export async function signInOnly(page: Page, { freezeTime = true } = {}) {
  if (freezeTime)
    await page.clock.install({ time: new Date("2026-11-23T12:00:00.000Z") });
  await page.goto("/");
  await fillSignIn(page);
}

export async function signIn(
  page: Page,
  mode = "personal",
  region = "US",
  options?: { freezeTime?: boolean },
) {
  await signInOnly(page, options);
  await page.getByLabel("Region").selectOption(region);
  await page.getByLabel("Workspace").selectOption(mode);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Your money, in motion." }),
  ).toBeVisible();
}

const MENU = {
  en: { button: "Account menu", signOut: "Sign out" },
  es: { button: "Menú de la cuenta", signOut: "Cerrar sesión" },
};

/** Opens the user menu, unless it is already open. */
export async function openMenu(page: Page, language: "en" | "es" = "en") {
  const menu = page.getByRole("menu");
  if (!(await menu.isVisible()))
    await page.getByRole("button", { name: MENU[language].button }).click();
  await expect(menu).toBeVisible();
}

export async function chooseTheme(
  page: Page,
  name: string,
  language: "en" | "es" = "en",
) {
  await openMenu(page, language);
  await page.getByRole("menuitemradio", { name }).click();
  await page.keyboard.press("Escape");
}

export async function signOut(page: Page, language: "en" | "es" = "en") {
  await openMenu(page, language);
  await page.getByRole("menuitem", { name: MENU[language].signOut }).click();
}

export async function fillLoanForm(page: Page, name: string, principal = "90") {
  await page.locator("#loan-name").fill(name);
  await page.locator("#loan-principal").fill(principal);
  await page.locator("#loan-term").fill("3");
  await page.locator("#loan-rate").fill("0");
  await page.locator("#loan-first-due-date").fill("2026-12-15");
}

export function contrastRatio(foreground: string, background: string): number {
  function luminance(color: string): number {
    const channels = color
      .match(/\d+(?:\.\d+)?/g)
      ?.slice(0, 3)
      .map(Number);
    if (!channels || channels.length !== 3)
      throw new Error(`Unexpected computed color: ${color}`);
    const [red, green, blue] = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export async function getContrastPair(
  page: Page,
  selector: string,
): Promise<[string, string]> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.color, style.backgroundColor];
    });
}

export async function getControlBoundaryContrast(
  page: Page,
  control: string,
  surface: string,
): Promise<number> {
  const border = await page
    .locator(control)
    .first()
    .evaluate((element) => {
      const shadow = getComputedStyle(element).boxShadow;
      const color = shadow.match(/rgba?\([^)]+\)/)?.[0];
      if (!color) throw new Error(`Missing control boundary: ${shadow}`);
      return color;
    });
  const background = await page
    .locator(surface)
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  return contrastRatio(border, background);
}
