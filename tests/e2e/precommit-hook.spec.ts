import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";

// Runs real git and lefthook, so it is too slow for the unit suite.
// No browser is used, so run it once: in desktop Chromium only.
test.skip(
  ({ browserName, viewport }) =>
    browserName !== "chromium" || (viewport?.width ?? 0) < 800,
  "runs once",
);

test("formats only staged changes before running the checks", () => {
  const directory = mkdtempSync(join(tmpdir(), "budgify-precommit-"));
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, {
      cwd: directory,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout;
  };
  try {
    git("init");
    symlinkSync(
      resolve("node_modules"),
      join(directory, "node_modules"),
      "junction",
    );
    copyFileSync(resolve("package.json"), join(directory, "package.json"));
    copyFileSync(resolve("lefthook.yml"), join(directory, "lefthook.yml"));
    mkdirSync(join(directory, "scripts"));
    writeFileSync(
      join(directory, "scripts", "check.mjs"),
      'console.log("CHECK_SENTINEL"); process.exit(Number(process.env.HOOK_TEST_EXIT));\n',
    );
    const sample = join(directory, "sample.js");
    writeFileSync(sample, "const value = 0;\n");
    git("add", "sample.js");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-m",
      "baseline",
    );
    writeFileSync(sample, "const value=1;\n");
    git("add", "sample.js");
    writeFileSync(sample, "const value=1;\nconst later=2;\n");
    const hook = spawnSync("npx lefthook run pre-commit", {
      cwd: directory,
      shell: true,
      encoding: "utf8",
      env: { ...process.env, HOOK_TEST_EXIT: "1" },
    });
    expect(hook.status).not.toBe(0);
    expect(hook.stdout).toContain("CHECK_SENTINEL");
    expect(git("show", ":sample.js")).toBe("const value = 1;\n");
    expect(git("diff", "--", "sample.js")).toContain("const later=2;");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
