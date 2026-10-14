import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
if (process.platform !== "win32" || process.arch !== "x64") {
  throw new Error(
    "Cette version est distribuée pour Windows x64. Voir README.md.",
  );
}
await exec(process.execPath, ["node_modules/electron/install.js"], {
  windowsHide: true,
});
const { stdout } = await exec(
  "powershell.exe",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "scripts/install-ffmpeg.ps1",
  ],
  { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
);
process.stdout.write(stdout);
await import("./setup-vbcable.mjs");
