import { useCallback, useEffect, useState } from "react";
import type { AppState } from "../storage/model";
import type { BusinessData, BusinessStore } from "./business-store";

export type BusinessDataState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: BusinessData };

type Outcome = { status: "error" } | { status: "ready"; data: BusinessData };

export interface BusinessDataHandle {
  state: BusinessDataState;
  reload: () => void;
  /** Applies a change to the loaded records, after the server has saved it. */
  change: (apply: (data: BusinessData) => BusinessData) => void;
}

/**
 * Loads the shared records fresh each time Small Business is opened.
 * Nothing is shown from before the load, and nothing is kept once it is closed.
 */
export function useBusinessData(
  store: BusinessStore | null,
  enabled: boolean,
): BusinessDataHandle {
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    if (!store || !enabled) return;
    let active = true;
    store
      .load()
      .then((data) => active && setOutcome({ status: "ready", data }))
      .catch(() => active && setOutcome({ status: "error" }));
    return () => {
      active = false;
      setOutcome(null);
    };
  }, [store, enabled, attempt]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  const change = useCallback(
    (apply: (data: BusinessData) => BusinessData) =>
      setOutcome((current) =>
        current?.status === "ready"
          ? { status: "ready", data: apply(current.data) }
          : current,
      ),
    [],
  );

  const state: BusinessDataState =
    !store || !enabled
      ? { status: "idle" }
      : (outcome ?? { status: "loading" });
  return { state, reload, change };
}

/** The local app state with the server's Small Business records in place of the empty local ones. */
export function withBusinessData(
  local: AppState,
  data: BusinessData | null,
): AppState {
  if (!data) return local;
  return {
    ...local,
    workspaces: {
      ...local.workspaces,
      business: {
        ...local.workspaces.business,
        region: data.region,
        baseCurrency: data.baseCurrency,
        loans: data.loans,
        payments: data.payments,
        income: data.income,
      },
    },
  };
}
