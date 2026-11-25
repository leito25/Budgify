import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";

const event = JSON.parse(readFileSync(0, "utf8"));
const result = spawnSync("npm run check:quick", {
  cwd: realpathSync.native(event.cwd),
  shell: true,
  encoding: "utf8",
  timeout: 240_000,
  maxBuffer: 10 * 1024 * 1024,
});
const failed = result.error || result.status !== 0;
const output = [result.stdout, result.stderr, result.error?.message]
  .filter(Boolean)
  .join("\n");
if (failed && !event.stop_hook_active) {
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: `npm run check:quick failed. Fix the failures before finishing:\n${output}`,
    }),
  );
} else {
  if (failed)
    process.stderr.write(`npm run check:quick still fails:\n${output}\n`);
  process.stdout.write("{}");
}
