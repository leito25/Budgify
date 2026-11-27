// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { translate } from "../../src/i18n";
import { SearchBox } from "../../src/search/SearchBox";
import type { SearchResult } from "../../src/search/local-search";

afterEach(cleanup);

const t = (key: Parameters<typeof translate>[1]) => translate("en", key);
const loan: SearchResult = { kind: "loan", id: "l1", name: "Bakery oven" };
const income: SearchResult = { kind: "income", id: "i1", name: "Bakery sales" };

function setup(search: (text: string) => Promise<SearchResult[]>) {
  const onSelect = vi.fn();
  render(<SearchBox search={search} onSelect={onSelect} t={t} />);
  const input = screen.getByRole("combobox", {
    name: "Search loans and income",
  });
  return { input, onSelect };
}

describe("search box", () => {
  it("lists results that name the kind of record", async () => {
    const { input } = setup(() => Promise.resolve([loan, income]));
    fireEvent.change(input, { target: { value: "bak" } });
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "LoanBakery oven",
      "IncomeBakery sales",
    ]);
  });

  it("says so when nothing matches", async () => {
    const { input } = setup(() => Promise.resolve([]));
    fireEvent.change(input, { target: { value: "zzz" } });
    expect((await screen.findByRole("status")).textContent).toBe(
      "No loans or income match.",
    );
  });

  it("reports a failed search", async () => {
    const { input } = setup(() => Promise.reject(new Error("down")));
    fireEvent.change(input, { target: { value: "a" } });
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Search did not work. Try again.",
    );
  });

  it("works with the keyboard: arrows move, Enter chooses, Escape closes", async () => {
    const { input, onSelect } = setup(() => Promise.resolve([loan, income]));
    fireEvent.change(input, { target: { value: "bak" } });
    await screen.findAllByRole("option");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(
      screen.getAllByRole("option").map((o) => o.getAttribute("aria-selected")),
    ).toEqual(["false", "true"]);
    expect(input.getAttribute("aria-activedescendant")).toBe(
      screen.getAllByRole("option")[1].id,
    );
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(loan);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect((input as HTMLInputElement).value).toBe("");

    fireEvent.change(input, { target: { value: "bak" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes the results when focus leaves the box", async () => {
    const { input } = setup(() => Promise.resolve([loan]));
    fireEvent.change(input, { target: { value: "bak" } });
    await screen.findByRole("listbox");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    fireEvent.blur(input);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("chooses a result with the mouse", async () => {
    const { input, onSelect } = setup(() => Promise.resolve([income]));
    fireEvent.change(input, { target: { value: "bak" } });
    fireEvent.click(await screen.findByRole("option"));
    expect(onSelect).toHaveBeenCalledWith(income);
  });

  it("shows only the newest search when answers arrive out of order", async () => {
    const answers: Record<string, (value: SearchResult[]) => void> = {};
    const { input } = setup(
      (text) =>
        new Promise((resolve) => {
          answers[text] = resolve;
        }),
    );
    fireEvent.change(input, { target: { value: "b" } });
    fireEvent.change(input, { target: { value: "ba" } });
    answers.ba([income]);
    await screen.findByRole("option");
    answers.b([loan]);
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(screen.getByRole("option").textContent).toContain("Bakery sales");
  });
});
