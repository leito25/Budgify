import { useEffect, useState } from "react";
import type { Theme } from "../storage/model";

export type ResolvedTheme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function deviceQuery(): MediaQueryList | null {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_QUERY)
    : null;
}

export function resolveTheme(
  choice: Theme,
  deviceIsDark: boolean,
): ResolvedTheme {
  if (choice === "system") return deviceIsDark ? "dark" : "light";
  return choice;
}

/** The theme to show now. System follows the device and changes with it while the app is open. */
export function useResolvedTheme(choice: Theme): ResolvedTheme {
  const [deviceIsDark, setDeviceIsDark] = useState(
    () => deviceQuery()?.matches ?? false,
  );

  useEffect(() => {
    const query = deviceQuery();
    if (choice !== "system" || !query) return;
    const update = () => setDeviceIsDark(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [choice]);

  return resolveTheme(choice, deviceIsDark);
}
