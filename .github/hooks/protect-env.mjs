import { readFileSync } from "node:fs";
import { win32 } from "node:path";

const event = JSON.parse(readFileSync(0, "utf8"));
if (typeof event.toolName !== "string" || !("toolArgs" in event)) {
  throw new Error("Expected a preToolUse event with toolName and toolArgs.");
}
const name = event.toolName.split(".").at(-1).toLowerCase();
let args = event.toolArgs;
if (typeof args === "string" && !args.startsWith("*** Begin Patch")) {
  try {
    args = JSON.parse(args);
  } catch {
    // Free-form tool input is not necessarily JSON.
  }
}

function isEnvPath(value) {
  return (
    typeof value === "string" &&
    win32.basename(value.trim()).toLowerCase() === ".env"
  );
}

function patchEditsEnv(patch) {
  return (
    typeof patch === "string" &&
    patch.split(/\r?\n/).some((line) => {
      const header = line.match(
        /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/,
      );
      return header && isEnvPath(header[1]);
    })
  );
}

const editTool = /^(?:apply_patch|edit|create|write|str_replace_editor)$/.test(
  name,
);
const shellTool = /^(?:powershell|bash|shell|terminal|exec)$/.test(name);
const fields = args && typeof args === "object" ? args : {};
const patch =
  typeof args === "string"
    ? args
    : (fields.patch ?? fields.input ?? fields.content);
const pathFields = ["path", "file_path", "filePath", "target", "uri"];
const directEdit =
  editTool &&
  (patchEditsEnv(patch) || pathFields.some((key) => isEnvPath(fields[key])));
const command = typeof args === "string" ? args : fields.command;
const shellReference =
  shellTool &&
  typeof command === "string" &&
  /(?:^|[\s\\/"'=:;<>|&([{])\.env(?=$|[\s\\/"'=:;<>|&)\]}])/i.test(command);

process.stdout.write(
  JSON.stringify(
    directEdit || shellReference
      ? {
          permissionDecision: "deny",
          permissionDecisionReason: "Agent edits to .env are blocked.",
        }
      : {},
  ),
);
