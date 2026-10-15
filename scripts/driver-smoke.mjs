import { _electron as electron, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Requires an existing VB-CABLE installation. Never invokes its installer.
// SOUNDBOARD_EXPECT_DRIVER=disabled also verifies the Windows settings action.
const expected = process.env.SOUNDBOARD_EXPECT_DRIVER || "installed";
if (!["installed", "disabled"].includes(expected)) throw new Error("Expected installed or disabled driver");
await mkdir(".test-data", { recursive: true });
await mkdir("test-results", { recursive: true });
const data = await mkdtemp(resolve(".test-data/driver-desktop-"));
const env = { ...process.env, SOUNDBOARD_DATA_DIR: data };
delete env.ELECTRON_RUN_AS_NODE;
const results = [];
for (let launch = 1; launch <= 2; launch++) {
  const desktop = await electron.launch({
    ...(process.env.SOUNDBOARD_TEST_EXE
      ? { executablePath: process.env.SOUNDBOARD_TEST_EXE, args: [] }
      : { args: ["."] }),
    cwd: resolve("."),
    env,
    timeout: 30_000,
  });
  try {
    const page = await desktop.firstWindow();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await expect(page.getByRole("heading", { name: "Votre bibliothèque de sons." })).toBeVisible();
    // Inspect real device names, but prevent any microphone capture in this test.
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new Error("Microphone capture is disabled during driver detection tests");
      };
    });
    const state = async () => {
      const response = await page.evaluate(() => window.soundboard.getState());
      expect(response.ok).toBe(true);
      return response.value;
    };
    await expect.poll(async () => (await state()).driver.status, { timeout: 20_000 }).toBe(expected);
    await page.getByRole("navigation").getByRole("button", { name: "En jeu", exact: true }).click();
    await expect(page.getByRole("button", { name: "Installer le composant audio", exact: true })).toHaveCount(0);
    if (expected === "installed") {
      await expect(page.getByRole("button", { name: "Composant installé", exact: true })).toBeDisabled();
      await expect(page.getByRole("option", { name: /CABLE Input/ }).first()).toHaveCount(1);
    } else {
      await expect(page.getByText(/VB-CABLE est installé, mais désactivé/)).toBeVisible();
      // Verify the IPC target without opening Windows settings during automated tests.
      await desktop.evaluate(({ shell }) => {
        globalThis.__openedAudioPath = null;
        shell.openPath = async (path) => { globalThis.__openedAudioPath = path; return ""; };
      });
      await page.getByRole("button", { name: "Ouvrir les réglages audio", exact: true }).click();
      await expect.poll(() => desktop.evaluate(() => globalThis.__openedAudioPath)).toMatch(/[\\/]System32[\\/]mmsys\.cpl$/i);
    }
    await page.getByRole("button", { name: "Actualiser", exact: true }).click();
    await expect(page.getByRole("button", { name: "Actualiser", exact: true })).toBeEnabled({ timeout: 20_000 });
    expect((await state()).driver.status).toBe(expected);
    expect((await state()).gameSession.status).toBe("off");
    await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 640));
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `test-results/driver-detection-${launch}.png` });
    expect(errors).toEqual([]);
    results.push({ launch, driver: (await state()).driver.status, cableOutputSelectable: expected === "installed", rendererErrors: errors });
  } catch (error) {
    const page = await desktop.firstWindow();
    await page.screenshot({ path: "test-results/driver-detection-error.png" });
    console.log(await page.evaluate(() => ({
      options: [...document.querySelectorAll("option")].map((option) => option.textContent).filter((name) => /CABLE|VB-Audio|Choisir|détecté/i.test(name)),
      alerts: [...document.querySelectorAll('[role="alert"]')].map((alert) => alert.textContent),
    })));
    throw error;
  } finally {
    await desktop.close();
  }
}
const report = {
  date: new Date().toISOString(),
  results,
  limits: ["Aucune installation de pilote, capture micro ou diffusion audio effectuée."],
};
await writeFile("test-results/driver-smoke-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
