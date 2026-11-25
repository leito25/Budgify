import { spawnSync } from "node:child_process";

const quick = process.argv.includes("--quick");
const precommit = process.argv.includes("--precommit");
const checks = [
  ...(!precommit
    ? [
        [
          "Prettier",
          'npx prettier --check "src/**/*.{ts,tsx,css}" "tests/**/*.{ts,tsx}" "*.ts" index.html',
        ],
      ]
    : []),
  ["ESLint", "npx eslint ."],
  ...(!precommit ? [["Ruff format", "ruff format --check ."]] : []),
  ["Ruff lint", "ruff check ."],
  ["TypeScript", "npm run typecheck"],
  ["ty", "ty check ."],
  [
    "Gitleaks",
    precommit
      ? "gitleaks git --staged --redact --no-banner --no-color --verbose ."
      : "node scripts/scan-secrets.mjs",
  ],
  ...(!precommit ? [["Tests", quick ? "npm run test:unit" : "npm test"]] : []),
];

let failed = false;
for (const [name, command] of checks) {
  console.log(`\n--- ${name} ---`);
  const result = spawnSync(command, { shell: true, stdio: "inherit" });
  if (result.error) console.error(`${name}: ${result.error.message}`);
  if (result.status !== 0) {
    console.error(
      `${name} failed${result.status === null ? "" : ` (exit ${result.status})`}.`,
    );
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
