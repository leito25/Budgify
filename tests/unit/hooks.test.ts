import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function runHook(script: string, input: object, env = process.env) {
  return spawnSync(process.execPath, [resolve(".github", "hooks", script)], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env,
  });
}

describe("agent hooks", () => {
  it.each([
    {
      toolName: "apply_patch",
      toolArgs: "*** Begin Patch\n*** Update File: .env\n*** End Patch",
    },
    {
      toolName: "apply_patch",
      toolArgs: "*** Begin Patch\n*** Move to: folder/.env\n*** End Patch",
    },
    { toolName: "edit", toolArgs: { path: "C:\\project\\.env" } },
    {
      toolName: "powershell",
      toolArgs: { command: 'Set-Content -LiteralPath ".env" -Value "test"' },
    },
  ])("denies direct .env edits", (event) => {
    const result = runHook("protect-env.mjs", event);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).permissionDecision).toBe("deny");
  });

  it.each([
    {
      toolName: "apply_patch",
      toolArgs: "*** Begin Patch\n*** Update File: .env.example\n*** End Patch",
    },
    { toolName: "view", toolArgs: { path: ".env" } },
    {
      toolName: "powershell",
      toolArgs: { command: "node -p process.env.PATH" },
    },
  ])("allows unrelated tool calls", (event) => {
    const result = runHook("protect-env.mjs", event);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({});
  });

  it("fails closed on a malformed pre-tool event", () => {
    expect(runHook("protect-env.mjs", {}).status).not.toBe(0);
  });

  it("blocks a failed quick check once, and lets a continued turn stop", () => {
    const directory = mkdtempSync(join(tmpdir(), "budgify-hook-"));
    try {
      const windows = process.platform === "win32";
      const npm = join(directory, windows ? "npm.cmd" : "npm");
      writeFileSync(
        npm,
        windows
          ? "@echo off\r\necho CHECK_SENTINEL\r\nexit /b %HOOK_TEST_EXIT%\r\n"
          : '#!/bin/sh\necho CHECK_SENTINEL\nexit "$HOOK_TEST_EXIT"\n',
      );
      if (!windows) chmodSync(npm, 0o755);
      const env = {
        ...process.env,
        PATH: `${directory}${delimiter}${process.env.PATH}`,
        HOOK_TEST_EXIT: "1",
      };
      const event = { cwd: process.cwd(), stop_hook_active: false };
      const failed = runHook("check-stop.mjs", event, env);
      expect(failed.status).toBe(0);
      expect(JSON.parse(failed.stdout)).toMatchObject({
        decision: "block",
        reason: expect.stringContaining("CHECK_SENTINEL"),
      });
      const continued = runHook(
        "check-stop.mjs",
        { ...event, stop_hook_active: true },
        env,
      );
      expect(JSON.parse(continued.stdout)).toEqual({});
      expect(continued.stderr).toContain("CHECK_SENTINEL");
      const passed = runHook("check-stop.mjs", event, {
        ...env,
        HOOK_TEST_EXIT: "0",
      });
      expect(JSON.parse(passed.stdout)).toEqual({});
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("runs the check from the canonical working directory", () => {
    const directory = mkdtempSync(join(tmpdir(), "budgify-hook-cwd-"));
    try {
      const windows = process.platform === "win32";
      const npm = join(directory, windows ? "npm.cmd" : "npm");
      writeFileSync(
        npm,
        windows
          ? "@echo off\r\ncd\r\nexit /b 1\r\n"
          : "#!/bin/sh\npwd -P\nexit 1\n",
      );
      if (!windows) chmodSync(npm, 0o755);
      const cwd = realpathSync.native(process.cwd());
      const eventCwd = windows
        ? cwd.replace(/^[A-Z]:/, (drive) => drive.toLowerCase())
        : cwd;
      const result = runHook(
        "check-stop.mjs",
        { cwd: eventCwd, stop_hook_active: false },
        { ...process.env, PATH: `${directory}${delimiter}${process.env.PATH}` },
      );
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        decision: "block",
        reason: expect.stringContaining(cwd),
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("pre-commit hook", () => {
  it("reports redacted secret findings and skips tests", () => {
    const directory = mkdtempSync(join(tmpdir(), "budgify-check-"));
    try {
      const windows = process.platform === "win32";
      for (const command of ["npx", "npm", "ruff", "ty", "gitleaks"]) {
        const path = join(directory, windows ? `${command}.cmd` : command);
        const scan =
          command === "gitleaks"
            ? windows
              ? '@echo %* | findstr /c:"--verbose" >nul\r\nif errorlevel 1 exit /b 2\r\n@echo %* | findstr /c:"--redact" >nul\r\nif errorlevel 1 exit /b 2\r\necho FINDING_DETAILS_REDACTED\r\nexit /b 1\r\n'
              : 'case " $* " in *" --verbose "*) ;; *) exit 2;; esac\ncase " $* " in *" --redact "*) echo FINDING_DETAILS_REDACTED;; esac\nexit 1\n'
            : windows
              ? "exit /b 0\r\n"
              : "exit 0\n";
        writeFileSync(
          path,
          windows ? `@echo off\r\n${scan}` : `#!/bin/sh\n${scan}`,
        );
        if (!windows) chmodSync(path, 0o755);
      }

      const result = spawnSync(
        process.execPath,
        [resolve("scripts", "check.mjs"), "--precommit"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${directory}${delimiter}${process.env.PATH}`,
          },
        },
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("FINDING_DETAILS_REDACTED");
      expect(result.stdout).not.toContain("--- Tests ---");
      expect(result.stderr).toContain("Gitleaks failed");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("formats only staged changes before running the checks", () => {
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
  }, 30_000);
});
