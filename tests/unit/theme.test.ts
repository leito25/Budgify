// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { resolveTheme, useResolvedTheme } from "../../src/theme/theme";
import { createInitialState } from "../../src/storage/seed";

/** A device setting that tests can flip, like the operating system's dark mode. */
function stubDevice(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_type: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      listeners.delete(listener),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );
  return {
    set(next: boolean) {
      query.matches = next;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("theme", () => {
  it("is Light by default", () => {
    expect(createInitialState("2026-11-23").theme).toBe("light");
    stubDevice(true);
    const { result } = renderHook(() => useResolvedTheme("light"));
    expect(result.current).toBe("light");
  });

  it("uses an explicit choice whatever the device says", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("follows the device with System, and changes with it", () => {
    const device = stubDevice(false);
    const { result } = renderHook(() => useResolvedTheme("system"));
    expect(result.current).toBe("light");
    act(() => device.set(true));
    expect(result.current).toBe("dark");
    act(() => device.set(false));
    expect(result.current).toBe("light");
  });

  it("stops following the device when another theme is chosen", () => {
    const device = stubDevice(true);
    const { result, rerender, unmount } = renderHook(
      ({ choice }: { choice: "system" | "light" }) => useResolvedTheme(choice),
      { initialProps: { choice: "system" } },
    );
    expect(result.current).toBe("dark");
    expect(device.listenerCount()).toBe(1);
    rerender({ choice: "light" });
    expect(result.current).toBe("light");
    expect(device.listenerCount()).toBe(0);
    unmount();
  });

  it("works where the device setting is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useResolvedTheme("system"));
    expect(result.current).toBe("light");
  });
});
