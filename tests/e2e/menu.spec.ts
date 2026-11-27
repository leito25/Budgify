import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  chooseTheme,
  contrastRatio,
  fillSignIn,
  getContrastPair,
  openMenu,
  signIn,
  signOut,
  watchBrowserErrors,
} from "./support";

const html = (page: Page) => page.locator("html");

test("the menu shows the person's initials in a Sea Green circle", async ({
  page,
}) => {
  await signIn(page);
  const avatar = page.getByRole("button", { name: "Account menu" });
  await expect(avatar).toContainText("AT");
  await expect(avatar).toHaveCSS("background-color", "rgb(6, 214, 160)");
  await expect(avatar).toHaveCSS("color", "rgb(7, 59, 76)");
  await expect(avatar).toHaveCSS("border-radius", "50%");
  expect(
    contrastRatio(...(await getContrastPair(page, ".user-avatar"))),
  ).toBeGreaterThan(4.5);
  await expect(page.getByRole("button", { name: "Use dark mode" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});

test("Light, Dark and System can be chosen, and the choice survives a reload", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await page.emulateMedia({ colorScheme: "light" });
  await signIn(page);
  await expect(html(page)).toHaveAttribute("data-theme", "light");

  await chooseTheme(page, "Dark");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await openMenu(page);
  await expect(
    page.getByRole("menuitemradio", { name: "Dark" }),
  ).toHaveAttribute("aria-checked", "true");

  await chooseTheme(page, "Light");
  await expect(html(page)).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(html(page)).toHaveAttribute("data-theme", "light");
  expect(errors).toEqual([]);
});

test("System follows the device's setting and changes with it", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await signIn(page);
  await expect(html(page)).toHaveAttribute("data-theme", "light");
  await chooseTheme(page, "System");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html(page)).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html(page)).toHaveAttribute("data-theme", "light");
});

test("the theme choice is remembered across sign-out and sign-in", async ({
  page,
}) => {
  await signIn(page);
  await chooseTheme(page, "Dark");
  await signOut(page);
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await fillSignIn(page);
  await expect(
    page.getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
});

test("the menu is readable and passes accessibility checks in both themes", async ({
  page,
}) => {
  const errors = watchBrowserErrors(page);
  await signIn(page, "personal", "US", { freezeTime: false });
  for (const theme of ["Light", "Dark"]) {
    await chooseTheme(page, theme);
    await openMenu(page);
    const [, panelBackground] = await getContrastPair(page, ".user-menu-panel");
    for (const selector of [
      ".user-menu-person",
      ".user-menu-heading",
      ".user-menu-panel button[aria-checked='true']",
      ".user-menu-panel button[role='menuitem']",
    ]) {
      const [ink] = await getContrastPair(page, selector);
      expect(
        contrastRatio(ink, panelBackground),
        `${theme} ${selector}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `${theme} menu`).toEqual([]);
    await page.keyboard.press("Escape");
  }
  expect(errors).toEqual([]);
});

test("the menu works with the keyboard", async ({ page }) => {
  await signIn(page);
  const avatar = page.getByRole("button", { name: "Account menu" });
  await avatar.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(
    page.getByRole("menuitemradio", { name: "Light" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "Dark" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(avatar).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(avatar).toBeFocused();
});

test("Sign out is in the menu and returns to the sign-in screen", async ({
  page,
}) => {
  await signIn(page);
  await openMenu(page);
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Budgify" }),
  ).toBeVisible();
});

test("the menu fits and works at the phone width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await signIn(page);
  await openMenu(page);
  const panel = await page.getByRole("menu").boundingBox();
  expect(panel).not.toBeNull();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(320);
});
