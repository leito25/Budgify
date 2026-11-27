// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { translate } from "../../src/i18n";
import { UserMenu, initialsFor } from "../../src/components/UserMenu";
import type { Theme } from "../../src/storage/model";

afterEach(cleanup);

const t = (key: Parameters<typeof translate>[1]) => translate("en", key);
const ana = { id: "1", email: "ana@budgify.ng", name: "Ana Test" };

function setup(theme: Theme = "light", user = ana) {
  const onTheme = vi.fn();
  const onSignOut = vi.fn();
  render(
    <UserMenu
      user={user}
      theme={theme}
      onTheme={onTheme}
      onSignOut={onSignOut}
      t={t}
    />,
  );
  const button = screen.getByRole("button", { name: "Account menu" });
  return { button, onTheme, onSignOut, user: userEvent.setup() };
}

describe("initials", () => {
  it("come from the name, or from the email when there is no name", () => {
    expect(initialsFor(ana)).toBe("AT");
    expect(initialsFor({ ...ana, name: "marta" })).toBe("M");
    expect(initialsFor({ ...ana, name: "  carlos  de la  cruz " })).toBe("CD");
    expect(initialsFor({ ...ana, name: null })).toBe("A");
    expect(initialsFor({ ...ana, name: null, email: "sam.lee@x.ng" })).toBe(
      "SL",
    );
    expect(initialsFor({ ...ana, name: null, email: "@x.ng" })).toBe("?");
  });

  it("are shown on the button", () => {
    const { button } = setup();
    expect(button.querySelector("[aria-hidden]")?.textContent).toBe("AT");
  });
});

describe("user menu", () => {
  it("opens with Enter and with Space", async () => {
    for (const key of ["{Enter}", " "]) {
      const { button, user } = setup();
      button.focus();
      await user.keyboard(key);
      expect(screen.getByRole("menu")).toBeTruthy();
      expect(button.getAttribute("aria-expanded")).toBe("true");
      cleanup();
    }
  });

  it("closes with Escape and returns focus to the initials", async () => {
    const { button, user } = setup();
    button.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).not.toBe(button);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("offers Light, Dark and System and marks the current one", async () => {
    const { button, user } = setup("system");
    await user.click(button);
    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent?.replace("✓", ""))).toEqual([
      "Light",
      "Dark",
      "System",
    ]);
    expect(items.map((item) => item.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "true",
    ]);
    expect(document.activeElement).toBe(items[2]);
  });

  it("chooses a theme with the keyboard", async () => {
    const { button, onTheme, user } = setup("light");
    button.focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");
    expect(onTheme).toHaveBeenCalledWith("dark");
  });

  it("moves between items with the arrows, wrapping at each end", async () => {
    const { button, user } = setup("light");
    await user.click(button);
    const items = [
      ...screen.getAllByRole("menuitemradio"),
      screen.getByRole("menuitem"),
    ];
    expect(items).toHaveLength(4);
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(items[3]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(items[3]);
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(items[0]);
  });

  it("signs out and closes", async () => {
    const { button, onSignOut, user } = setup();
    await user.click(button);
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes when you click elsewhere", async () => {
    const { button, user } = setup();
    await user.click(button);
    await user.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
