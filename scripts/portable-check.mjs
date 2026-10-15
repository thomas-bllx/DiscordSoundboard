import { chromium, expect } from "@playwright/test";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
const executable = resolve(
  `release/Local-Discord-Soundboard-${version}-x64-portable.exe`,
);
await mkdir(".test-data", { recursive: true });
await mkdir("test-results", { recursive: true });
const data = await mkdtemp(resolve(".test-data/portable-"));
const server = createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
await new Promise((resolve) => server.close(resolve));
const env = { ...process.env, SOUNDBOARD_DATA_DIR: data };
delete env.ELECTRON_RUN_AS_NODE;
// The NSIS wrapper does not expose the main-process inspector to Playwright.
// A test-only Chromium debug port stays on loopback and is closed with the app.
const child = spawn(
  executable,
  [`--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1"],
  { env, windowsHide: true, stdio: "ignore" },
);
let exited = false;
const exit = new Promise((resolve) =>
  child.once("exit", (code) => {
    exited = true;
    resolve(code);
  }),
);
let browser, page;
try {
  let ready = false;
  const deadline = Date.now() + 50_000;
  while (Date.now() < deadline) {
    if (exited)
      throw new Error(
        "Le lanceur portable a quitté avant le démarrage du rendu.",
      );
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(700),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(250);
  }
  if (!ready)
    throw new Error("Le portable ne présente pas de rendu après 50 secondes.");
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  page = browser.contexts()[0].pages()[0];
  await expect(
    page.getByRole("heading", { name: "Votre bibliothèque de sons." }),
  ).toBeVisible();
  let state = await page.evaluate(() => window.soundboard.getState());
  expect(state.ok).toBe(true);
  expect(state.value.startupAvailable).toBe(false);
  // Keep preview explicit even on machines with an installed virtual cable.
  // Only the output adapter is simulated; decoded silence and volume zero
  // ensure this test never transmits a signal to a user's audio devices.
  await page.evaluate(() => {
    navigator.mediaDevices.enumerateDevices = async () => [{
      deviceId: "test-headset", kind: "audiooutput", groupId: "headset", label: "Casque de test",
    }];
    const setSink = HTMLMediaElement.prototype.setSinkId;
    HTMLMediaElement.prototype.setSinkId = function (id) {
      return setSink.call(this, id === "test-headset" ? "default" : id);
    };
  });
  const settings = await page.evaluate(() =>
    window.soundboard.updateSettings({
      masterVolume: 0,
      minimizeToTray: false,
      gameMonitorId: "test-headset",
    }),
  );
  expect(settings.ok).toBe(true);
  const samples = 96000;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24);
  wav.writeUInt32LE(96000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  const file = join(data, "portable.wav");
  await writeFile(file, wav);
  const imported = await page.evaluate(
    (path) => window.soundboard.importSounds([path]),
    file,
  );
  expect(imported).toEqual({ ok: true, value: { imported: 1, failures: [] } });
  state = await page.evaluate(() => window.soundboard.getState());
  const id = state.value.config.sounds[0].id;
  await page
    .getByRole("button", { name: "Jouer portable", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.soundboard.getState())).value.local
          .status,
    )
    .toBe("playing");
  const stopped = await page.evaluate(() => window.soundboard.stop());
  expect(stopped.ok).toBe(true);
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.soundboard.getState())).value.local
          .status,
    )
    .toBe("idle");
  const missingVoice = await page.evaluate(async (id) => {
    await window.soundboard.updateSettings({ output: "discord" });
    return window.soundboard.play(id);
  }, id);
  expect(missingVoice.ok).toBe(false);
  expect(missingVoice.error).toContain("salon vocal");
  await page.evaluate(() =>
    window.soundboard.updateSettings({ output: "local" }),
  );
  await page.screenshot({ path: "test-results/06-portable.png" });
  await page.evaluate(() => window.close()).catch(() => {});
  const code = await Promise.race([exit, delay(15000).then(() => "timeout")]);
  expect(code).toBe(0);
  const report = {
    date: new Date().toISOString(),
    executable,
    result: "PASS",
    checks: [
      "Extraction et démarrage autonome",
      "Interface disponible",
      "FFmpeg intégré : import réel WAV",
      "Préécoute réelle (volume zéro)",
      "STOP et moteur Discord/DAVE disponibles",
      "Erreur explicite si aucun salon",
      "Démarrage Windows désactivé pour le portable",
      "Fermeture complète du lanceur et de l’application",
    ],
    manualRemaining: [
      "Diffusion Discord réelle",
      "Valorant",
      "Parcours installeur",
    ],
  };
  await writeFile(
    "test-results/portable-smoke.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (page && !page.isClosed()) {
    await page
      .evaluate(async () => {
        await window.soundboard.updateSettings({ minimizeToTray: false });
        window.close();
      })
      .catch(() => {});
  }
  if (browser?.isConnected()) {
    const session = await browser.newBrowserCDPSession().catch(() => null);
    if (session)
      await Promise.race([
        session.send("Browser.close").catch(() => {}),
        delay(2000),
      ]);
  }
  await browser?.close().catch(() => {});
  if (!exited) {
    await Promise.race([exit, delay(3000)]);
    if (!exited) child.kill();
  }
}
