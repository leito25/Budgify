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
    rateBasis: mode === "business" ? "effective_annual" : "apr",
    interestType: id === "grocery" ? "simple" : "compound",
    penaltyRateAnnual: 0.12,
    firstDueDate,
    createdAt: firstDueDate,
  };
}

function createWorkspace(
  mode: WorkspaceMode,
  region: Region,
  currency: Currency,
  today: string,
): Workspace {
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
      : [
          createLoan(
            mode,
            "cafe",
            "Coffee equipment",
            18_000_000,
            18,
            shiftDate(today, 5),
            0.24,
          ),
          createLoan(
            mode,
            "bakery",
            "Bakery oven",
            12_500_000,
            12,
            shiftDate(today, 15),
            0.22,
          ),
          createLoan(
            mode,
            "delivery",
            "Delivery equipment",
            9_000_000,
            10,
            shiftDate(today, 25),
            0.2,
          ),
        ];
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
      : [
          {
            id: "business-sales",
            source: "Monthly sales",
            description: "",
            amountMinor: 60_000_000,
            dateReceived: today,
            frequency: "recurring",
          },
          {
            id: "business-order",
            source: "Seasonal order",
            description: "",
            amountMinor: 4_000_000,
            dateReceived: today,
            frequency: "one_time",
          },
        ];

  return {
    mode,
    region,
    currency,
    membershipUpgraded: false,
    loans,
    payments: [],
    income,
  };
}

export function createInitialState(
  today = new Date().toISOString().slice(0, 10),
  regions: Partial<Record<WorkspaceMode, Region>> = {},
): AppState {
  parseDateOnly(today);
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    userName: null,
    isSignedIn: false,
    hasSignedIn: false,
    activeMode: "personal",
    language: "en",
    theme: "light",
    workspaces: {
      personal: createWorkspace(
        "personal",
        regions.personal ?? "US",
        (regions.personal ?? "US") === "CO" ? "COP" : "USD",
        today,
      ),
      business: createWorkspace(
        "business",
        regions.business ?? "CO",
        (regions.business ?? "CO") === "CO" ? "COP" : "USD",
        today,
      ),
    },
    gameProgress: {},
  };
}

export function resetState(
  today = new Date().toISOString().slice(0, 10),
): AppState {
  return createInitialState(today);
}
