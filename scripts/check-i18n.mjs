import { readFile } from "node:fs/promises";

const root = new URL("../src/i18n/", import.meta.url);
const files = ["en.ts", "es.ts"];
const dictionaries = new Map();

for (const file of files) {
  const source = await readFile(new URL(file, root), "utf8");
  const keys = [...source.matchAll(/^\s*"([^"]+)"\s*:/gm)].map((match) => match[1]);
  dictionaries.set(file.slice(0, 2), new Set(keys));
}

const english = dictionaries.get("en");
const spanish = dictionaries.get("es");
const missingSpanish = [...english].filter((key) => !spanish.has(key));
const missingEnglish = [...spanish].filter((key) => !english.has(key));

if (missingSpanish.length || missingEnglish.length) {
  if (missingSpanish.length) console.error(`Missing in Spanish: ${missingSpanish.join(", ")}`);
  if (missingEnglish.length) console.error(`Missing in English: ${missingEnglish.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Translation key parity verified (${english.size} keys).`);
}
