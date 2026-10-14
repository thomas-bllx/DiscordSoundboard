import "./build.mjs";
import { createServer } from "vite";
import { spawn } from "node:child_process";
import electron from "electron";
const server = await createServer();
await server.listen();
const childEnv = {
  ...process.env,
  SOUNDBOARD_DEV_URL: "http://127.0.0.1:5173",
};
delete childEnv.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ["."], {
  stdio: "inherit",
  windowsHide: true,
  env: childEnv,
});
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  child.kill();
  await server.close();
};
child.on("exit", async (code) => {
  await close();
  process.exit(code ?? 0);
});
process.on("SIGINT", close);
process.on("SIGTERM", close);
