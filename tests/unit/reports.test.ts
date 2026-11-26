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

  it("converts every monetary column after calculating the base schedule", () => {
    const loan = makeLoan({
      principalMinor: 100_000,
      termMonths: 1,
      interestType: "simple",
      rate: 0.1,
      firstDueDate: "2026-01-01",
    });
    const original = structuredClone(loan);
    const csv = buildAmortizationCsv(
      [loan],
      [
        {
          loanId: loan.id,
          installmentIndex: 1,
          paidDate: "2026-01-10",
          scheduledAmountMinor: 110_000,
          penaltyMinor: 250,
          totalPaidMinor: 110_250,
        },
      ],
      "USD",
      "en",
      "2026-01-10",
      { currency: "COP", rate: 4000 },
    );
    const [header, row] = csv.split("\r\n");
    expect(header).toContain('"Payment (COP)"');
    expect(header).toContain('"Late interest (COP)"');
    expect(row).toContain('"4400000","4000000","400000","0"');
    expect(row).toContain('"2026-01-10","10000"');
    expect(loan).toEqual(original);
  });
});
