export type Currency = "COP" | "USD";
export type Region = "CO" | "US";
export type WorkspaceMode = "personal" | "business";
export type InterestType = "simple" | "compound";
export type RateBasis = "monthly_nominal" | "effective_annual" | "apr";

export interface PersonRef {
  id: string;
  name: string | null;
  email: string;
}

/** Who added and changed a shared record, and when. Local records have none. */
export interface Audit {
  addedBy?: PersonRef;
  addedAt?: string;
  changedBy?: PersonRef;
  changedAt?: string;
}

export interface Loan extends Audit {
  id: string;
  name: string;
  description: string;
  principalMinor: number;
  termMonths: number;
  rate: number;
  rateBasis: RateBasis;
  interestType: InterestType;
  penaltyRateAnnual: number;
  firstDueDate: string;
  createdAt: string;
}

export interface Payment extends Audit {
  loanId: string;
  installmentIndex: number;
  paidDate: string;
  scheduledAmountMinor: number;
  penaltyMinor: number;
  totalPaidMinor: number;
  settledBy?: PersonRef;
  settledAt?: string;
}

export interface Installment {
  index: number;
  dueDate: string;
  amountMinor: number;
  principalMinor: number;
  interestMinor: number;
  remainingPrincipalMinor: number;
}

export type LoanStatus = "Active" | "In grace" | "Overdue" | "Paid";

export interface IncomeEntry extends Audit {
  id: string;
  source: string;
  description: string;
  amountMinor: number;
  dateReceived: string;
  frequency: "one_time" | "recurring";
}

export interface Workspace {
  mode: WorkspaceMode;
  region: Region;
  baseCurrency: Currency;
  displayCurrency: Currency;
  membershipUpgraded: boolean;
  loans: Loan[];
  payments: Payment[];
  income: IncomeEntry[];
}

export interface GameProgress {
  mode: WorkspaceMode;
  month: number;
  cashMinor: number;
  debtMinor: number;
  bufferMinor: number;
  interestAvoidedMinor: number;
  completedChallengeIds: string[];
  decisions: string[];
}
