// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import App from "../../src/App";
import type { AppState } from "../../src/storage/model";
import { LocalStorageBackend } from "../../src/storage/fallback";
import { StorageRepository } from "../../src/storage/repository";

Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  configurable: true,
  value(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  },
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  configurable: true,
  value(this: HTMLDialogElement) {
    this.removeAttribute("open");
  },
});

beforeEach(() => {
  vi.setSystemTime(new Date("2026-11-23T12:00:00.000Z"));
  localStorage.clear();
  window.location.hash = "";
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function signIn(mode = "personal", region = "US") {
  render(<App />);
  fireEvent.change(await screen.findByLabelText("Your name"), {
    target: { value: "Alex" },
  });
  fireEvent.change(screen.getByLabelText("Region"), {
    target: { value: region },
  });
  fireEvent.change(screen.getByLabelText("Workspace"), {
    target: { value: mode },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Your money, in motion." });
}

async function navigate(name: string) {
  fireEvent.click(screen.getByRole("link", { name }));
  await screen.findAllByRole("heading", { name });
}

function savedState(): AppState {
  const raw = localStorage.getItem("budgify-state");
  if (!raw) throw new Error("Missing saved state");
  return (JSON.parse(raw) as { data: AppState }).data;
}

describe("app workflows", () => {
  it.each([
    {
      region: "US",
      display: "COP",
      currency: "USD",
      original: "2700.00",
      input: "123.45",
      minor: 12345,
    },
    {
      region: "CO",
      display: "USD",
      currency: "COP",
      original: "270000",
      input: "12345",
      minor: 12345,
    },
  ])(
    "uses $currency in editors when conversion is unavailable",
    async ({ region, display, currency, original, input, minor }) => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      await signIn("personal", region);
      fireEvent.change(screen.getByLabelText("Currency"), {
        target: { value: display },
      });
      await screen.findByText(
        "Conversion is unavailable until an exchange rate can be fetched.",
      );

      await navigate("Loans & Installments");
      const loan = screen.getByRole("row", { name: /Grocery installment/ });
      fireEvent.click(within(loan).getByRole("button", { name: "Edit" }));
      expect(screen.getByText(`Enter amounts in ${currency}.`)).toBeTruthy();
      expect(
        (screen.getByLabelText("Principal") as HTMLInputElement).value,
      ).toBe(original);
      fireEvent.change(screen.getByLabelText("Loan name"), {
        target: { value: "Renamed grocery" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await screen.findByRole("row", { name: /Renamed grocery/ });
      expect(savedState().workspaces.personal.loans[0].principalMinor).toBe(
        270000,
      );

      const renamed = screen.getByRole("row", { name: /Renamed grocery/ });
      fireEvent.click(within(renamed).getByRole("button", { name: "Edit" }));
      fireEvent.change(screen.getByLabelText("Principal"), {
        target: { value: input },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(savedState().workspaces.personal.loans[0].principalMinor).toBe(
          minor,
        ),
      );

      await navigate("Income & Balance");
      const income = screen.getByRole("row", { name: /Monthly salary/ });
      fireEvent.click(within(income).getByRole("button", { name: "Edit" }));
      expect(screen.getByText(`Enter amounts in ${currency}.`)).toBeTruthy();
      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: input },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(savedState().workspaces.personal.income[0].amountMinor).toBe(
          minor,
        ),
      );
    },
  );

  it("preserves an unchanged base amount when converted display rounding is lossy", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ result: "success", rates: { USD: 0.0002511 } }),
            { status: 200 },
          ),
        ),
    );
    await signIn("personal", "CO");
    fireEvent.change(screen.getByLabelText("Currency"), {
      target: { value: "USD" },
    });
    await waitFor(() =>
      expect(savedState().exchangeRateCache["COP:USD"]).toBe(0.0002511),
    );
    await navigate("Income & Balance");
    const income = screen.getByRole("row", { name: /Monthly salary/ });
    fireEvent.click(within(income).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "Renamed salary" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("row", { name: /Renamed salary/ });
    expect(savedState().workspaces.personal.income[0].amountMinor).toBe(480000);
    await navigate("Loans & Installments");
    const loan = screen.getByRole("row", { name: /Grocery installment/ });
    fireEvent.click(within(loan).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Loan name"), {
      target: { value: "Renamed grocery" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("row", { name: /Renamed grocery/ });
    expect(savedState().workspaces.personal.loans[0].principalMinor).toBe(
      270000,
    );
  });

  it("keeps the editor currency stable if a rate arrives while editing", async () => {
    let respond!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            respond = resolve;
          }),
      ),
    );
    await signIn();
    fireEvent.change(screen.getByLabelText("Currency"), {
      target: { value: "COP" },
    });
    await waitFor(() => expect(respond).toBeDefined());
    await navigate("Income & Balance");
    const income = screen.getByRole("row", { name: /Monthly salary/ });
    fireEvent.click(within(income).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "123.45" },
    });
    respond(
      new Response(
        JSON.stringify({ result: "success", rates: { COP: 4000 } }),
        { status: 200 },
      ),
    );
    await waitFor(() =>
      expect(savedState().exchangeRateCache["USD:COP"]).toBe(4000),
    );
    expect(screen.getByText("Enter amounts in USD.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(savedState().workspaces.personal.income[0].amountMinor).toBe(
        12345,
      ),
    );
  });

  it("caches a delayed rate under its requested pair after a queued workspace switch", async () => {
    let respond!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            respond = resolve;
          }),
      ),
    );
    await signIn();
    fireEvent.change(screen.getByLabelText("Currency"), {
      target: { value: "COP" },
    });
    await waitFor(() => expect(respond).toBeDefined());

    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const startedWrite = new Promise<void>((resolve) => {
      started = resolve;
    });
    const originalSet = LocalStorageBackend.prototype.set;
    vi.spyOn(LocalStorageBackend.prototype, "set").mockImplementation(
      async function (this: LocalStorageBackend, key, value) {
        const state = (JSON.parse(value) as { data: AppState }).data;
        if (
          key === "budgify-state" &&
          state.activeMode === "business" &&
          !state.exchangeRateCache["USD:COP"]
        ) {
          started();
          await blocked;
        }
        return originalSet.call(this, key, value);
      },
    );
    const updates = vi.spyOn(StorageRepository.prototype, "update");
    fireEvent.change(screen.getByLabelText("Workspace"), {
      target: { value: "business" },
    });
    await startedWrite;
    respond(
      new Response(
        JSON.stringify({ result: "success", rates: { COP: 4000 } }),
        { status: 200 },
      ),
    );
    await waitFor(() => expect(updates).toHaveBeenCalledTimes(2));
    release();
    await waitFor(() =>
      expect(savedState().exchangeRateCache["USD:COP"]).toBe(4000),
    );
    expect(savedState().activeMode).toBe("business");
    expect(savedState().exchangeRateCache["COP:COP"]).toBeUndefined();
  });

  it("shows the selected display currency without changing stored base values", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ result: "success", rates: { COP: 4000 } }),
            { status: 200 },
          ),
        ),
    );
    await signIn();
    fireEvent.change(screen.getByLabelText("Currency"), {
      target: { value: "COP" },
    });
    await waitFor(() => expect(screen.getByText(/COP/)).toBeTruthy());
  });

  it("starts in light mode and applies a selected theme across sign-in", async () => {
    render(<App />);
    await screen.findByLabelText("Your name");
    expect(document.documentElement.dataset.theme).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "Use dark mode" }));
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark"),
    );
    expect(screen.getByRole("button", { name: "Use light mode" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Your money, in motion." });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Use light mode" })).toBeTruthy();
  });

  it("creates, edits, searches and deletes loans and income", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await signIn();
    await navigate("Loans & Installments");
    fireEvent.click(screen.getByRole("button", { name: "Add loan" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getAllByText("This field is required.").length,
    ).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Loan name"), {
      target: { value: "Unit loan" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Purchase" },
    });
    fireEvent.change(screen.getByLabelText("Principal"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("Installments"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Interest rate (%)"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("First payment date"), {
      target: { value: "2026-12-15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rate Helper" }));
    expect(
      screen.getByText("Reference only, verify with your bank."),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Credit-card accounts assessed interest/,
      }),
    );
    fireEvent.change(screen.getByLabelText("Rate basis"), {
      target: { value: "monthly_nominal" },
    });
    fireEvent.change(screen.getByLabelText("Interest type"), {
      target: { value: "simple" },
    });
    fireEvent.change(screen.getByLabelText("Annual late-fee rate (%)"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const loan = await screen.findByRole("row", { name: /Unit loan/ });
    fireEvent.click(within(loan).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Loan name"), {
      target: { value: "Edited loan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("row", { name: /Edited loan/ });
    fireEvent.change(screen.getByLabelText("Search loans"), {
      target: { value: "Edited loan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Loan name" }));
    confirm.mockReturnValueOnce(false);
    fireEvent.click(
      within(screen.getByRole("row", { name: /Edited loan/ })).getByRole(
        "button",
        { name: "Delete" },
      ),
    );
    expect(screen.getByRole("row", { name: /Edited loan/ })).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole("row", { name: /Edited loan/ })).getByRole(
        "button",
        { name: "Delete" },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("row", { name: /Edited loan/ })).toBeNull(),
    );

    await navigate("Income & Balance");
    fireEvent.click(screen.getByRole("button", { name: "Add income" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getAllByText("This field is required.").length,
    ).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "Consulting" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Project" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "125" },
    });
    fireEvent.change(screen.getByLabelText("Date received"), {
      target: { value: "2026-11-23" },
    });
    fireEvent.change(screen.getByLabelText("Frequency"), {
      target: { value: "one_time" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const income = await screen.findByRole("row", { name: /Consulting/ });
    expect(within(income).getByText("One time")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Amount" }));
    fireEvent.click(within(income).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "Edited income" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const edited = await screen.findByRole("row", { name: /Edited income/ });
    fireEvent.click(within(edited).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.queryByRole("row", { name: /Edited income/ })).toBeNull(),
    );
  }, 15_000);

  it("updates payments and quest progress and can sign out", async () => {
    await signIn();
    await navigate("Payment Calendar");
    const payment = screen.getAllByRole("button", {
      name: "Mark paid in full",
    })[0];
    fireEvent.click(payment);
    await waitFor(() => expect(payment.isConnected).toBe(false));
    await navigate("Loans & Installments");
    const paidLoan = screen.getByRole("row", { name: /Grocery installment/ });
    fireEvent.click(within(paidLoan).getByRole("button", { name: "Edit" }));
    expect(
      (screen.getByLabelText("Principal") as HTMLInputElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await navigate("Reports");
    expect(
      screen.getByRole("heading", { name: "Next five payments" }),
    ).toBeTruthy();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    fireEvent.click(
      screen.getByRole("button", { name: "Print one-page summary" }),
    );
    expect(print).toHaveBeenCalledOnce();
    await navigate("Financial Quest");
    fireEvent.click(
      screen.getByRole("button", { name: "Pay down high-interest debt" }),
    );
    await screen.findByText("Month 2 of 6");
    fireEvent.click(screen.getByRole("button", { name: "Restart scenario" }));
    await screen.findByText("Month 1 of 6");
    for (let month = 2; month <= 6; month += 1) {
      fireEvent.click(
        screen.getByRole("button", { name: "Build an emergency buffer" }),
      );
      await screen.findByText(`Month ${month} of 6`);
    }
    fireEvent.click(
      screen.getByRole("button", { name: "Build an emergency buffer" }),
    );
    await screen.findByRole("heading", { name: "Financial Quest", level: 2 });
    fireEvent.change(screen.getByRole("combobox", { name: "Workspace" }), {
      target: { value: "business" },
    });
    await screen.findByText("Month 1 of 6");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(
      ((await screen.findByLabelText("Your name")) as HTMLInputElement).value,
    ).toBe("Alex");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Financial Quest" });
    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "es" },
    });
    await screen.findByRole("heading", { name: "Reto financiero" });
  });

  it("enforces the business limit until upgrade and resets the profile", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await signIn("business", "CO");
    await navigate("Loans & Installments");
    fireEvent.click(screen.getByRole("button", { name: "Add loan" }));
    fireEvent.change(screen.getByLabelText("Loan name"), {
      target: { value: "Business loan" },
    });
    fireEvent.change(screen.getByLabelText("Principal"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("heading", { name: /three-active-loan limit/ });
    fireEvent.click(
      screen.getByRole("button", { name: "Accept simulated upgrade" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /three-active-loan limit/ }),
      ).toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("row", { name: /Business loan/ });
    fireEvent.click(screen.getByRole("button", { name: "Reset sample data" }));
    expect(
      ((await screen.findByLabelText("Your name")) as HTMLInputElement).value,
    ).toBe("");
  });

  it("reports failed writes and recovers corrupt stored data", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await signIn();
    const save = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage full");
      });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Your change could not be saved",
    );
    save.mockRestore();
    cleanup();
    localStorage.setItem("budgify-state", "invalid");
    render(<App />);
    await screen.findByRole("heading", {
      name: /Saved data could not be updated/,
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset sample data" }));
    expect(
      ((await screen.findByLabelText("Your name")) as HTMLInputElement).value,
    ).toBe("");
  });
});
