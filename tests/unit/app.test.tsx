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
import type { Region, WorkspaceMode } from "../../src/domain/types";
import { CURRENT_SCHEMA_VERSION, type AppState } from "../../src/storage/model";
import { createInitialState } from "../../src/storage/seed";
import { LocalStorageBackend } from "../../src/storage/fallback";
import { StorageRepository } from "../../src/storage/repository";
import { seedSession, stubFetch, TEST_PASSWORD } from "./fake-backend";

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
  stubFetch();
  seedSession();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Opens the app signed in, with the workspace already chosen. */
async function signIn(mode: WorkspaceMode = "personal", region: Region = "US") {
  const state = createInitialState("2026-11-23", { [mode]: region });
  state.hasChosenWorkspace = true;
  state.activeMode = mode;
  localStorage.setItem(
    "budgify-state",
    JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, data: state }),
  );
  render(<App />);
  await screen.findByRole("heading", { name: "Your money, in motion." });
}

async function chooseWorkspaceInForm(mode = "personal", region = "US") {
  render(<App />);
  fireEvent.change(await screen.findByLabelText("Region"), {
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

/** Table rows by their text. Cheaper than role queries, which slow big tables in jsdom. */
function rowsMatching(name: RegExp): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("tr")].filter((row) =>
    name.test(row.textContent ?? ""),
  );
}

function queryRow(name: RegExp): HTMLElement | null {
  return rowsMatching(name)[0] ?? null;
}

function getRow(name: RegExp): HTMLElement {
  const rows = rowsMatching(name);
  if (rows.length !== 1)
    throw new Error(`Expected one row matching ${name}, found ${rows.length}`);
  return rows[0];
}

function findRow(name: RegExp): Promise<HTMLElement> {
  return waitFor(() => getRow(name));
}

function openMenu() {
  if (!screen.queryByRole("menu"))
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
}

function chooseTheme(name: "Light" | "Dark" | "System") {
  openMenu();
  fireEvent.click(screen.getByRole("menuitemradio", { name }));
}

function signOut() {
  openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
}

function fillSignIn(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

/** Signs in to Small Business and waits for the server's records. */
async function signInToBusiness() {
  const backend = stubFetch();
  await signIn("business", "CO");
  await waitFor(() => expect(backend.requests).toContain("GET /api/workspace"));
  await screen.findByRole("heading", { name: "Your money, in motion." });
  return backend;
}

function savedState(): AppState {
  const raw = localStorage.getItem("budgify-state");
  if (!raw) throw new Error("Missing saved state");
  return (JSON.parse(raw) as { data: AppState }).data;
}

describe("app workflows", () => {
  const withoutConversion: {
    region: Region;
    display: string;
    currency: string;
    original: string;
    input: string;
    minor: number;
  }[] = [
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
  ];

  async function openWithoutConversion(region: Region, display: string) {
    stubFetch(vi.fn().mockRejectedValue(new Error("offline")));
    await signIn("personal", region);
    fireEvent.change(screen.getByLabelText("Currency"), {
      target: { value: display },
    });
    await screen.findByText(
      "Conversion is unavailable until an exchange rate can be fetched.",
    );
  }

  it.each(withoutConversion)(
    "shows $currency in the loan editor and keeps the principal when only the name changes",
    async ({ region, display, currency, original }) => {
      await openWithoutConversion(region, display);
      await navigate("Loans & Installments");
      const loan = getRow(/Grocery installment/);
      fireEvent.click(within(loan).getByRole("button", { name: "Edit" }));
      expect(screen.getByText(`Enter amounts in ${currency}.`)).toBeTruthy();
      expect(
        (screen.getByLabelText("Principal") as HTMLInputElement).value,
      ).toBe(original);
      fireEvent.change(screen.getByLabelText("Loan name"), {
        target: { value: "Renamed grocery" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await findRow(/Renamed grocery/);
      expect(savedState().workspaces.personal.loans[0].principalMinor).toBe(
        270000,
      );
    },
  );

  it.each(withoutConversion)(
    "saves a principal typed in $currency as the base amount",
    async ({ region, display, input, minor }) => {
      await openWithoutConversion(region, display);
      await navigate("Loans & Installments");
      const loan = getRow(/Grocery installment/);
      fireEvent.click(within(loan).getByRole("button", { name: "Edit" }));
      fireEvent.change(screen.getByLabelText("Principal"), {
        target: { value: input },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(savedState().workspaces.personal.loans[0].principalMinor).toBe(
          minor,
        ),
      );
    },
  );

  it.each(withoutConversion)(
    "uses $currency in the income editor when conversion is unavailable",
    async ({ region, display, currency, input, minor }) => {
      await openWithoutConversion(region, display);
      await navigate("Income & Balance");
      const income = getRow(/Monthly salary/);
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
    stubFetch(
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
    const income = getRow(/Monthly salary/);
    fireEvent.click(within(income).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "Renamed salary" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await findRow(/Renamed salary/);
    expect(savedState().workspaces.personal.income[0].amountMinor).toBe(480000);
    await navigate("Loans & Installments");
    const loan = getRow(/Grocery installment/);
    fireEvent.click(within(loan).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Loan name"), {
      target: { value: "Renamed grocery" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await findRow(/Renamed grocery/);
    expect(savedState().workspaces.personal.loans[0].principalMinor).toBe(
      270000,
    );
  });

  it("keeps the editor currency stable if a rate arrives while editing", async () => {
    let respond!: (response: Response) => void;
    stubFetch(
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
    const income = getRow(/Monthly salary/);
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
    stubFetch(
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
    stubFetch(
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

  it("starts in light mode and keeps a chosen theme after signing out and in", async () => {
    await signIn();
    expect(document.documentElement.dataset.theme).toBe("light");

    chooseTheme("Dark");
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark"),
    );
    expect(savedState().theme).toBe("dark");
    signOut();
    await screen.findByLabelText("Email");
    expect(document.documentElement.dataset.theme).toBe("dark");
    fillSignIn("ana@budgify.ng", TEST_PASSWORD);
    await screen.findByRole("heading", { name: "Your money, in motion." });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("restores a saved theme on a reload, and System follows the device", async () => {
    let dark = true;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        get matches() {
          return dark;
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    await signIn();
    chooseTheme("System");
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark"),
    );
    cleanup();
    dark = false;
    render(<App />);
    await screen.findByRole("heading", { name: "Your money, in motion." });
    expect(savedState().theme).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  async function addLoan(name: string) {
    await navigate("Loans & Installments");
    fireEvent.click(screen.getByRole("button", { name: "Add loan" }));
    fireEvent.change(screen.getByLabelText("Loan name"), {
      target: { value: name },
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
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    return findRow(new RegExp(name));
  }

  it("validates and creates a loan", async () => {
    await signIn();
    await navigate("Loans & Installments");
    fireEvent.click(screen.getByRole("button", { name: "Add loan" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getAllByText("This field is required.").length,
    ).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Purchase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const loan = await addLoan("Unit loan");
    expect(loan.textContent).toContain("Unit loan");
    expect(savedState().workspaces.personal.loans).toHaveLength(3);
  });

  it("edits a loan and finds it with the ledger search", async () => {
    await signIn();
    const loan = await addLoan("Unit loan");
    fireEvent.click(within(loan).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Loan name"), {
      target: { value: "Edited loan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await findRow(/Edited loan/);
    fireEvent.change(screen.getByLabelText("Search loans"), {
      target: { value: "Edited loan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Loan name" }));
    expect(queryRow(/Grocery installment/)).toBeNull();
  });

  it("deletes a loan only after confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await signIn();
    await addLoan("Unit loan");
    fireEvent.click(
      within(getRow(/Unit loan/)).getByRole("button", { name: "Delete" }),
    );
    expect(getRow(/Unit loan/)).toBeTruthy();
    confirm.mockReturnValue(true);
    fireEvent.click(
      within(getRow(/Unit loan/)).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() => expect(queryRow(/Unit loan/)).toBeNull());
  });

  it("uses the Rate Helper to fill a loan's rate", async () => {
    await signIn();
    await navigate("Loans & Installments");
    fireEvent.click(screen.getByRole("button", { name: "Add loan" }));
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
    expect(
      (screen.getByLabelText("Interest type") as HTMLSelectElement).value,
    ).toBe("simple");
  });

  it("creates, edits and deletes income", async () => {
    await signIn();
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
    const income = await findRow(/Consulting/);
    expect(within(income).getByText("One time")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Amount" }));
    fireEvent.click(within(income).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "Edited income" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const edited = await findRow(/Edited income/);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(within(edited).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(queryRow(/Edited income/)).toBeNull());
  });

  it("marks an installment paid and locks the loan terms", async () => {
    await signIn();
    await navigate("Payment Calendar");
    const payment = screen.getAllByRole("button", {
      name: "Mark paid in full",
    })[0];
    fireEvent.click(payment);
    await waitFor(() => expect(payment.isConnected).toBe(false));
    await navigate("Loans & Installments");
    const paidLoan = getRow(/Grocery installment/);
    fireEvent.click(within(paidLoan).getByRole("button", { name: "Edit" }));
    expect(
      (screen.getByLabelText("Principal") as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it("prints the one-page report", async () => {
    await signIn();
    await navigate("Reports");
    expect(
      screen.getByRole("heading", { name: "Next five payments" }),
    ).toBeTruthy();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    fireEvent.click(
      screen.getByRole("button", { name: "Print one-page summary" }),
    );
    expect(print).toHaveBeenCalledOnce();
  });

  it("plays a quest scenario through to the end", async () => {
    await signIn();
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
  });

  it("signs out and back in, keeping Personal data and settings", async () => {
    await signIn();
    await navigate("Financial Quest");
    signOut();
    await screen.findByLabelText("Email");
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(localStorage.getItem("budgify-session")).toBeNull();
    fillSignIn("ana@budgify.ng", TEST_PASSWORD);
    await screen.findByRole("heading", { name: "Financial Quest" });
    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "es" },
    });
    await screen.findByRole("heading", { name: "Reto financiero" });
    expect(savedState().workspaces.personal.loans).toHaveLength(2);
  });

  it("enforces the business limit until upgrade", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const backend = await signInToBusiness();
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
    expect(backend.requests).not.toContain("POST /api/loans");
    fireEvent.click(
      screen.getByRole("button", { name: "Accept simulated upgrade" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /three-active-loan limit/ }),
      ).toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await findRow(/Business loan/);
    expect(backend.requests).toContain("POST /api/loans");
  });

  it("resets Personal data and asks for the workspace choice again", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await signIn();
    fireEvent.click(screen.getByRole("button", { name: "Reset sample data" }));
    await screen.findByLabelText("Region");
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("shows Small Business records from the server, not from the browser", async () => {
    const backend = await signInToBusiness();
    await navigate("Loans & Installments");
    expect(getRow(/Bakery oven/)).toBeTruthy();
    expect(backend.requests).toContain("GET /api/workspace");
    expect(savedState().workspaces.business.loans).toEqual([]);
    await navigate("Income & Balance");
    expect(getRow(/Panadería seasonal/)).toBeTruthy();
  });

  it("shows who added each Small Business record", async () => {
    await signInToBusiness();
    await navigate("Loans & Installments");
    const row = getRow(/Coffee equipment/);
    expect(within(row).getByText("Added by Sample Team")).toBeTruthy();
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
    const dialog = document.querySelector("dialog") as HTMLElement;
    expect(within(dialog).getByText("Added by Sample Team")).toBeTruthy();
  });

  it("shows who added a record you add", async () => {
    await signInToBusiness();
    await navigate("Income & Balance");
    fireEvent.click(screen.getByRole("button", { name: "Add income" }));
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "Web sales" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "5000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const row = await findRow(/Web sales/);
    expect(within(row).getByText("Added by Ana Test")).toBeTruthy();
  });

  it("shows who settled an installment", async () => {
    await signInToBusiness();
    await navigate("Payment Calendar");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Mark paid in full" })[0],
    );
    await screen.findAllByText("Settled by Ana Test");
  });

  it("shows a failed Small Business save instead of treating it as saved", async () => {
    const backend = await signInToBusiness();
    await navigate("Income & Balance");
    backend.failWrites = true;
    fireEvent.click(screen.getByRole("button", { name: "Add income" }));
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "Lost sale" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Your change could not be saved",
    );
    expect(queryRow(/Lost sale/)).toBeNull();
  });

  it("shows an error with a retry when the Small Business data cannot be loaded", async () => {
    const backend = stubFetch();
    const read = backend.handle.bind(backend);
    let down = true;
    backend.handle = (url, init) =>
      down && url.startsWith("/api/workspace")
        ? Promise.resolve(new Response(null, { status: 500 }))
        : read(url, init);
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Workspace"), {
      target: { value: "business" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Small Business data could not be loaded", {
      exact: false,
    });
    down = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Your money, in motion." });
  });

  it("reports failed writes and recovers corrupt stored data", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await signIn();
    const save = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage full");
      });
    chooseTheme("Dark");
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
    await screen.findByLabelText("Region");
  });

  it("asks for a workspace and currency once after the first sign-in", async () => {
    await chooseWorkspaceInForm("business", "CO");
    expect(savedState()).toMatchObject({
      hasChosenWorkspace: true,
      activeMode: "business",
    });
    expect(savedState().workspaces.business.displayCurrency).toBe("COP");
  });

  it("searches Personal records locally and opens the ledger with the record highlighted", async () => {
    await signIn();
    fireEvent.change(
      screen.getByRole("combobox", { name: "Search loans and income" }),
      {
        target: { value: "MICRO" },
      },
    );
    fireEvent.click(
      await screen.findByRole("option", { name: /Personal microloan/ }),
    );
    await screen.findByRole("heading", { name: "Loans & Installments" });
    expect(window.location.hash).toBe("#loans/personal-microloan");
    const row = getRow(/Personal microloan/);
    expect(row.className).toBe("highlighted");
    expect(getRow(/Grocery installment/).className).toBe("");
  });

  it("searches Small Business records on the server", async () => {
    const backend = await signInToBusiness();
    fireEvent.change(
      screen.getByRole("combobox", { name: "Search loans and income" }),
      {
        target: { value: "pan" },
      },
    );
    fireEvent.click(
      await screen.findByRole("option", { name: /Panadería seasonal order/ }),
    );
    await screen.findByRole("heading", { name: "Income & Balance" });
    expect(backend.requests).toContain("GET /api/search?q=pan");
    expect(getRow(/Panadería seasonal/).className).toBe("highlighted");
  });

  it("shows only the sign-in screen when signed out", async () => {
    localStorage.removeItem("budgify-session");
    window.location.hash = "loans";
    render(<App />);
    await screen.findByRole("heading", { name: "Sign in to Budgify" });
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Loans & Installments" }),
    ).toBeNull();
  });

  it("refuses a wrong password with one message and opens the app with the right one", async () => {
    localStorage.removeItem("budgify-session");
    render(<App />);
    await screen.findByLabelText("Email");
    fillSignIn("ana@budgify.ng", "wrong");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("The email or password is not correct.");
    fillSignIn("ana@budgify.ng", TEST_PASSWORD);
    await screen.findByLabelText("Region");
    expect(localStorage.getItem("budgify-session")).toContain("access-token");
  });

  it("returns to the sign-in screen when the server refuses the session", async () => {
    const backend = await signInToBusiness();
    await navigate("Income & Balance");
    backend.handle = () => Promise.resolve(new Response(null, { status: 401 }));
    fireEvent.click(screen.getByRole("button", { name: "Add income" }));
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "X" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByLabelText("Email");
    expect(screen.getByText("Your session ended. Sign in again.")).toBeTruthy();
  });
});
