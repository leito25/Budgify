import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const listing = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
});
if (listing.error) throw listing.error;
if (listing.status !== 0) {
  process.stderr.write(listing.stderr);
  process.exit(listing.status ?? 1);
}

const files = [...new Set(listing.stdout.split("\0").filter(Boolean))];
let failed = false;
let scanned = 0;
for (const file of files) {
  const path = resolve(file);
  if (!existsSync(path)) continue;
  const result = spawnSync("gitleaks", ["dir", "--redact", "--no-banner", "--no-color", "--log-level", "warn", path], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`Gitleaks failed for ${file}.`);
    failed = true;
  }
  scanned += 1;
}
console.log(`Gitleaks scanned ${scanned} tracked and non-ignored files.`);
process.exitCode = failed ? 1 : 0;
