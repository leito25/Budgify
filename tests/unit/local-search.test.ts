import { describe, expect, it } from "vitest";
import { searchLocal } from "../../src/search/local-search";
import { createInitialState } from "../../src/storage/seed";

const workspace = createInitialState("2026-11-23").workspaces.personal;

describe("local search", () => {
  it("matches part of a name in any case", () => {
    for (const text of ["groc", "GROC", "Grocery Install", "  grocery "]) {
      expect(searchLocal(workspace, text)).toEqual([
        { kind: "loan", id: "personal-grocery", name: "Grocery installment" },
      ]);
    }
  });

  it("names the kind of record and finds loans and income together", () => {
    const results = searchLocal(workspace, "o");
    expect(results.map((result) => result.kind)).toEqual([
      "loan",
      "loan",
      "income",
      "income",
    ]);
    expect(results.at(-1)?.name).toBe("One-time bonus");
  });

  it("matches accented names whatever the case", () => {
    const accented = {
      ...workspace,
      loans: [{ ...workspace.loans[0], id: "x", name: "Panadería Ruiz" }],
    };
    expect(searchLocal(accented, "PANADERÍA")).toHaveLength(1);
    expect(searchLocal(accented, "pan")).toHaveLength(1);
  });

  it("finds nothing for no text or no match", () => {
    expect(searchLocal(workspace, "")).toEqual([]);
    expect(searchLocal(workspace, "   ")).toEqual([]);
    expect(searchLocal(workspace, "zzz")).toEqual([]);
  });
});
