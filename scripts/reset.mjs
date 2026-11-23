import { spawn } from "node:child_process";
import { platform } from "node:os";

const target = process.argv[2] ?? "http://127.0.0.1:5173/";
let url;

try {
  url = new URL(target);
} catch {
  console.error("Usage: npm run reset [http://localhost:5173/]");
  process.exit(1);
}

if (!["http:", "https:"].includes(url.protocol)) {
  console.error("Reset URL must use HTTP or HTTPS.");
  process.exit(1);
}

const command = platform() === "win32" ? "rundll32.exe"
  : platform() === "darwin" ? "open"
    : "xdg-open";
const args = platform() === "win32" ? ["url.dll,FileProtocolHandler", url.href] : [url.href];
const browser = spawn(command, args, { detached: true, stdio: "ignore" });

browser.once("error", (error) => {
  console.error(`Could not open the app in a browser: ${error.message}`);
  process.exitCode = 1;
});
browser.unref();
console.log(`Opened ${url.origin}. Use “Reset sample data” in the app and confirm to clear this browser profile's Budgify data.`);
