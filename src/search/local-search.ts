import type { Workspace } from "../domain/types";

export interface SearchResult {
  kind: "loan" | "income";
  id: string;
  name: string;
}

/** Loans and income entries whose name contains the text, ignoring case. */
export function searchLocal(
  workspace: Workspace,
  text: string,
): SearchResult[] {
  const wanted = text.trim().toLocaleLowerCase();
  if (!wanted) return [];
  const matches = (name: string) => name.toLocaleLowerCase().includes(wanted);
  return [
    ...workspace.loans
      .filter((loan) => matches(loan.name))
      .map((loan) => ({ kind: "loan" as const, id: loan.id, name: loan.name })),
    ...workspace.income
      .filter((entry) => matches(entry.source))
      .map((entry) => ({
        kind: "income" as const,
        id: entry.id,
        name: entry.source,
      })),
  ];
}
