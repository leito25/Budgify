import type { Loan, Payment, WorkspaceMode } from "./types";

export function canCreateActiveLoan(
  mode: WorkspaceMode,
  loans: Loan[],
  membershipUpgraded: boolean,
  payments: Payment[] = [],
): { allowed: boolean; requiresUpgrade: boolean } {
  if (mode === "personal" || membershipUpgraded) {
    return { allowed: true, requiresUpgrade: false };
  }

  const activeLoans = loans.filter((loan) => {
    const paidInstallments = new Set(
      payments
        .filter((payment) => payment.loanId === loan.id)
        .map((payment) => payment.installmentIndex),
    );
    return paidInstallments.size < loan.termMonths;
  }).length;

  const requiresUpgrade = activeLoans >= 3;
  return { allowed: !requiresUpgrade, requiresUpgrade };
}
