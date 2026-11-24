import { describe, expect, it } from "vitest";
import { buildAmortizationCsv } from "../../src/domain/reports";
import { makeLoan } from "../fixtures/loans";

describe("amortization reports", () => {
  it("exports the complete schedule with translated headers and untouched user text", () => {
    const loan = makeLoan({
      name: 'Cafe, "North"',
      description: "Do not translate: ñ",
    });
    const english = buildAmortizationCsv([loan], [], "USD", "en");
    const spanish = buildAmortizationCsv([loan], [], "USD", "es");

    expect(english.split("\r\n")).toHaveLength(4);
    expect(english).toContain('"Cafe, ""North"""');
    expect(english).toContain("Do not translate: ñ");
    expect(english.split("\r\n")[0]).toContain("Due date");
    expect(spanish.split("\r\n")[0]).toContain("Fecha de pago");
    expect(spanish).toContain("Do not translate: ñ");
  });
});
