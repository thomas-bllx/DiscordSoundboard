import { createServer } from "vite";
import { _electron, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
await mkdir(".test-data", { recursive: true });
await mkdir("test-results", { recursive: true });
const data = await mkdtemp(resolve(".test-data/dev-"));
const server = await createServer();
await server.listen();
const env = {
  ...process.env,
  SOUNDBOARD_DATA_DIR: data,
  SOUNDBOARD_DEV_URL: "http://127.0.0.1:5173",
};
delete env.ELECTRON_RUN_AS_NODE;
let desktop;
try {
  desktop = await _electron.launch({ args: ["."], env });
  const page = await desktop.firstWindow();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(
    page.getByRole("heading", { name: "Votre bibliothèque de sons." }),
  ).toBeVisible();
  const result = await page.evaluate(() => window.soundboard.getState());
  expect(result.ok).toBe(true);
  expect(page.url()).toContain("http://127.0.0.1:5173");
  expect(errors).toEqual([]);
  const report = {
    date: new Date().toISOString(),
    result: "Vite + React + IPC Electron en mode développement : OK",
    errors,
  };
  await writeFile(
    "test-results/dev-smoke.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await desktop?.close();
  await server.close();
}
