import { describe, expect, it } from "vitest";
import { canCreateActiveLoan } from "../../src/domain/business-limit";
import { makeLoan } from "../fixtures/loans";

describe("active-loan limit", () => {
  it("allows three business loans and blocks a fourth until upgrade", () => {
    expect(
      canCreateActiveLoan(
        "business",
        [makeLoan(), makeLoan({ id: "2" }), makeLoan({ id: "3" })],
        false,
      ),
    ).toEqual({ allowed: false, requiresUpgrade: true });
    expect(
      canCreateActiveLoan(
        "business",
        [makeLoan(), makeLoan({ id: "2" })],
        false,
      ),
    ).toEqual({ allowed: true, requiresUpgrade: false });
    expect(
      canCreateActiveLoan(
        "business",
        [makeLoan(), makeLoan({ id: "2" }), makeLoan({ id: "3" })],
        true,
      ),
    ).toEqual({ allowed: true, requiresUpgrade: false });
  });

  it("does not limit Personal mode", () => {
    expect(
      canCreateActiveLoan(
        "personal",
        Array.from({ length: 10 }, (_, index) =>
          makeLoan({ id: String(index) }),
        ),
        false,
      ).allowed,
    ).toBe(true);
  });
});
