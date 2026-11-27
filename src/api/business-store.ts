import type {
  Currency,
  IncomeEntry,
  Loan,
  Payment,
  Region,
} from "../domain/types";
import type { ApiClient } from "./client";

/** The shared Small Business records, as the server holds them. */
export interface BusinessData {
  region: Region;
  baseCurrency: Currency;
  loans: Loan[];
  payments: Payment[];
  income: IncomeEntry[];
}

type LoanFields = Omit<
  Loan,
  "id" | "createdAt" | "addedBy" | "addedAt" | "changedBy" | "changedAt"
>;
type IncomeFields = Omit<
  IncomeEntry,
  "id" | "addedBy" | "addedAt" | "changedBy" | "changedAt"
>;

function loanFields(loan: Loan): LoanFields {
  return {
    name: loan.name,
    description: loan.description,
    principalMinor: loan.principalMinor,
    termMonths: loan.termMonths,
    rate: loan.rate,
    rateBasis: loan.rateBasis,
    interestType: loan.interestType,
    penaltyRateAnnual: loan.penaltyRateAnnual,
    firstDueDate: loan.firstDueDate,
  };
}

function incomeFields(entry: IncomeEntry): IncomeFields {
  return {
    source: entry.source,
    description: entry.description,
    amountMinor: entry.amountMinor,
    dateReceived: entry.dateReceived,
    frequency: entry.frequency,
  };
}

// The server stamps a full time; the app only needs the day.
function withCreatedDay(loan: Loan): Loan {
  return { ...loan, createdAt: loan.createdAt.slice(0, 10) };
}

interface WorkspaceResponse {
  region: Region;
  baseCurrency: Currency;
  loans: Loan[];
  payments: Payment[];
  income: IncomeEntry[];
}

/** Reads and writes Small Business records through the API. Every call returns what was saved. */
export class BusinessStore {
  constructor(private readonly client: ApiClient) {}

  async load(): Promise<BusinessData> {
    const workspace = await this.client.request<WorkspaceResponse>(
      "GET",
      "/api/workspace",
    );
    return { ...workspace, loans: workspace.loans.map(withCreatedDay) };
  }

  async createLoan(loan: Loan): Promise<Loan> {
    return withCreatedDay(
      await this.client.request<Loan>("POST", "/api/loans", loanFields(loan)),
    );
  }

  async updateLoan(loan: Loan): Promise<Loan> {
    return withCreatedDay(
      await this.client.request<Loan>(
        "PUT",
        `/api/loans/${loan.id}`,
        loanFields(loan),
      ),
    );
  }

  deleteLoan(loanId: string): Promise<void> {
    return this.client.request("DELETE", `/api/loans/${loanId}`);
  }

  settle(payment: Payment): Promise<Payment> {
    return this.client.request<Payment>(
      "POST",
      `/api/loans/${payment.loanId}/payments`,
      {
        installmentIndex: payment.installmentIndex,
        paidDate: payment.paidDate,
        scheduledAmountMinor: payment.scheduledAmountMinor,
        penaltyMinor: payment.penaltyMinor,
        totalPaidMinor: payment.totalPaidMinor,
      },
    );
  }

  createIncome(entry: IncomeEntry): Promise<IncomeEntry> {
    return this.client.request("POST", "/api/income", incomeFields(entry));
  }

  updateIncome(entry: IncomeEntry): Promise<IncomeEntry> {
    return this.client.request(
      "PUT",
      `/api/income/${entry.id}`,
      incomeFields(entry),
    );
  }

  deleteIncome(entryId: string): Promise<void> {
    return this.client.request("DELETE", `/api/income/${entryId}`);
  }
}
