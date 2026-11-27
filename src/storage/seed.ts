import type {
  Currency,
  IncomeEntry,
  Loan,
  Region,
  Workspace,
  WorkspaceMode,
} from "../domain/types";
import { parseDateOnly } from "../domain/dates";
import { CURRENT_SCHEMA_VERSION, type AppState } from "./model";

function shiftDate(dateValue: string, days: number): string {
  const date = parseDateOnly(dateValue);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function createLoan(
  mode: WorkspaceMode,
  id: string,
  name: string,
  principalMinor: number,
  termMonths: number,
  firstDueDate: string,
  rate: number,
): Loan {
  return {
    id: `${mode}-${id}`,
    name,
    description: "",
    principalMinor,
    termMonths,
    rate,
    rateBasis: "apr",
    interestType: id === "grocery" ? "simple" : "compound",
    penaltyRateAnnual: 0.12,
    firstDueDate,
    createdAt: firstDueDate,
  };
}

function createWorkspace(
  mode: WorkspaceMode,
  region: Region,
  baseCurrency: Currency,
  displayCurrency: Currency,
  today: string,
): Workspace {
  // Small Business records live on the server, not in the browser.
  const loans =
    mode === "personal"
      ? [
          createLoan(
            mode,
            "grocery",
            "Grocery installment",
            270_000,
            3,
            shiftDate(today, -10),
            0.18,
          ),
          createLoan(
            mode,
            "microloan",
            "Personal microloan",
            550_000,
            8,
            shiftDate(today, 10),
            0.24,
          ),
        ]
      : [];
  const income: IncomeEntry[] =
    mode === "personal"
      ? [
          {
            id: "personal-salary",
            source: "Monthly salary",
            description: "",
            amountMinor: 480_000,
            dateReceived: today,
            frequency: "recurring",
          },
          {
            id: "personal-one-time",
            source: "One-time bonus",
            description: "",
            amountMinor: 75_000,
            dateReceived: today,
            frequency: "one_time",
          },
        ]
      : [];

  return {
    mode,
    region,
    baseCurrency,
    displayCurrency,
    membershipUpgraded: false,
    loans,
    payments: [],
    income,
  };
}

function currencyForMode(
  mode: WorkspaceMode,
  regions: Partial<Record<WorkspaceMode, Region>>,
  currencies: Partial<Record<WorkspaceMode, Currency>>,
): Currency {
  if (currencies[mode]) return currencies[mode] as Currency;
  return (regions[mode] ?? (mode === "personal" ? "US" : "CO")) === "CO"
    ? "COP"
    : "USD";
}

export function createInitialState(
  today = new Date().toISOString().slice(0, 10),
  regions: Partial<Record<WorkspaceMode, Region>> = {},
  currencies: Partial<Record<WorkspaceMode, Currency>> = {},
): AppState {
  parseDateOnly(today);
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    hasChosenWorkspace: false,
    activeMode: "personal",
    language: "en",
    theme: "light",
    workspaces: {
      personal: createWorkspace(
        "personal",
        regions.personal ?? "US",
        currencyForMode("personal", regions, currencies),
        currencyForMode("personal", regions, currencies),
        today,
      ),
      business: createWorkspace(
        "business",
        regions.business ?? "CO",
        currencyForMode("business", regions, currencies),
        currencyForMode("business", regions, currencies),
        today,
      ),
    },
    exchangeRateCache: {},
    gameProgress: {},
  };
}

export function resetState(
  today = new Date().toISOString().slice(0, 10),
): AppState {
  return createInitialState(today);
}
