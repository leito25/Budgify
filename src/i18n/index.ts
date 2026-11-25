import { en } from "./en";
import { es } from "./es";
import type { Currency } from "../domain/types";

export type Language = "en" | "es";
export type TranslationKey = keyof typeof en;

const dictionaries = { en, es };

export function translate(language: Language, key: TranslationKey): string {
  const message: string | undefined = dictionaries[language][key];
  if (message === undefined)
    throw new RangeError(`Missing translation: ${key}`);
  return message;
}

export function formatLocaleDate(value: string, language: Language): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()))
    throw new RangeError("Date must use the YYYY-MM-DD format.");
  return new Intl.DateTimeFormat(language === "es" ? "es-CO" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export function localeFor(language: Language, currency: Currency): string {
  if (language === "es") return currency === "COP" ? "es-CO" : "es-US";
  return currency === "COP" ? "en-CO" : "en-US";
}

export function formatUserText(value: string): string {
  return value;
}
