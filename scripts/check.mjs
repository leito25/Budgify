import { spawnSync } from "node:child_process";

const quick = process.argv.includes("--quick");
const checks = [
  ["Prettier", 'npx prettier --check "src/**/*.{ts,tsx,css}" "tests/**/*.{ts,tsx}" "*.ts" index.html'],
  ["ESLint", "npx eslint ."],
  ["Ruff format", "ruff format --check ."],
  ["Ruff lint", "ruff check ."],
  ["TypeScript", "npm run typecheck"],
  ["ty", "ty check ."],
  ["Gitleaks", "node scripts/scan-secrets.mjs"],
  ["Tests", quick ? "npm run test:unit" : "npm test"],
];

let failed = false;
for (const [name, command] of checks) {
  console.log(`\n--- ${name} ---`);
  const result = spawnSync(command, { shell: true, stdio: "inherit" });
  if (result.error) console.error(`${name}: ${result.error.message}`);
  if (result.status !== 0) {
    console.error(`${name} failed${result.status === null ? "" : ` (exit ${result.status})`}.`);
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
