import { _electron as electron, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { testWav } from "./test-audio.mjs";
const exec = promisify(execFile);
await mkdir(".test-data", { recursive: true });
await mkdir("test-results", { recursive: true });
const data = await mkdtemp(resolve(".test-data/game-"));
const fixture = join(data, "Soundboard test.wav");
await writeFile(fixture, testWav(12));
const env = { ...process.env, SOUNDBOARD_DATA_DIR: data };
delete env.ELECTRON_RUN_AS_NODE;
const launchOptions = {
  ...(process.env.SOUNDBOARD_TEST_EXE
    ? {
        executablePath: process.env.SOUNDBOARD_TEST_EXE,
        args: [
          "--use-fake-device-for-media-stream",
          `--use-file-for-fake-audio-capture=${fixture}`,
        ],
      }
    : {
        args: [
          ".",
          "--use-fake-device-for-media-stream",
          `--use-file-for-fake-audio-capture=${fixture}`,
        ],
      }),
  cwd: resolve("."),
  env,
  timeout: 30_000,
};
let desktop = await electron.launch(launchOptions);
let page = await desktop.firstWindow();
const errors = [];
const results = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") console.log("renderer:", message.text());
});
async function invoke(method, ...args) {
  const result = await page.evaluate(
    ({ method, args }) => window.soundboard[method](...args),
    { method, args },
  );
  expect(result.ok, result.error).toBe(true);
  return result.value;
}
const state = () => invoke("getState");
const level = () =>
  page.evaluate(() => {
    const analyser = window.__gameAnalyser;
    if (!analyser) return 0;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
  });
try {
  await expect(
    page.getByRole("heading", { name: "Votre bibliothèque de sons." }),
  ).toBeVisible();
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setAudioMuted(true),
  );
  // Keep tests independent from a user's running soundboard and its default STOP.
  await invoke("updateSettings", { stopShortcut: "Control+Alt+F10" });
  const denied = await page.evaluate(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return false;
    } catch {
      return true;
    }
  });
  expect(denied).toBe(true);
  results.push("Microphone refusé par défaut, aucune capture au démarrage");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Micro virtuel", exact: true })
    .click();
  await expect
    .poll(async () => (await state()).driver.status)
    .not.toBe("checking");
  const driverState = (await state()).driver;
  await page.screenshot({ path: "test-results/07-game-setup.png" });
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(900, 640),
  );
  await page.screenshot({ path: "test-results/08-game-small.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1280, 840),
  );
  results.push(
    "Page Micro virtuel utilisable à 900 × 640 ; état du pilote Windows lu sans installation",
  );

  // Replace only device adapters. Audio files, decoder, gains, compressor and IPC stay real.
  // A silent Web Audio sink avoids transmitting test tones to any physical/virtual device.
  await page.evaluate(() => {
    window.__testDevices = [
      {
        kind: "audiooutput",
        deviceId: "test-cable",
        groupId: "cable",
        label: "CABLE Input (VB-Audio Virtual Cable)",
      },
      {
        kind: "audioinput",
        deviceId: "test-mic",
        groupId: "mic",
        label: "Microphone de test",
      },
      {
        kind: "audiooutput",
        deviceId: "test-headset",
        groupId: "headset",
        label: "Casque de test",
      },
    ];
    navigator.mediaDevices.enumerateDevices = async () => window.__testDevices;
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await originalGetUserMedia(
        constraints.audio?.deviceId?.exact === "test-mic"
          ? { audio: true, video: false }
          : constraints,
      );
      window.__testMic = stream.getAudioTracks()[0];
      return stream;
    };
    const sinks = new WeakMap();
    const originalSetSink = AudioContext.prototype.setSinkId;
    const sinkDescriptor = Object.getOwnPropertyDescriptor(
      AudioContext.prototype,
      "sinkId",
    );
    AudioContext.prototype.setSinkId = async function (id) {
      if (id === "test-cable") {
        sinks.set(this, id);
        return originalSetSink.call(this, { type: "none" });
      }
      return originalSetSink.call(this, id);
    };
    Object.defineProperty(AudioContext.prototype, "sinkId", {
      get() {
        return sinks.get(this) ?? sinkDescriptor.get.call(this);
      },
      configurable: true,
    });
    const setMediaSink = HTMLMediaElement.prototype.setSinkId;
    HTMLMediaElement.prototype.setSinkId = function (id) {
      return setMediaSink.call(this, id === "test-headset" ? "default" : id);
    };
    const streamDescriptor = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "srcObject",
    );
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      configurable: true,
      get: streamDescriptor.get,
      set(stream) {
        streamDescriptor.set.call(this, stream);
        if (!stream) {
          void window.__monitorContext?.close();
          return;
        }
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        const silent = context.createGain();
        silent.gain.value = 0;
        context.createMediaStreamSource(stream).connect(analyser);
        analyser.connect(silent);
        silent.connect(context.destination);
        window.__monitorAnalyser = analyser;
        window.__monitorContext = context;
        void context.setSinkId({ type: "none" }).then(() => context.resume());
      },
    });
    const compressor = AudioContext.prototype.createDynamicsCompressor;
    AudioContext.prototype.createDynamicsCompressor = function () {
      const node = compressor.call(this);
      const analyser = this.createAnalyser();
      analyser.fftSize = 2048;
      node.connect(analyser);
      window.__gameAnalyser = analyser;
      window.__gameContext = this;
      return node;
    };
  });
  await page.getByRole("button", { name: "Actualiser", exact: true }).click();
  await expect
    .poll(async () => (await state()).config.settings.gameOutputId)
    .toBe("test-cable");
  await invoke("updateSettings", { gameMonitorId: "test-headset" });
  await page
    .getByRole("button", { name: "Activer le mode jeu", exact: true })
    .click();
  await expect
    .poll(async () => (await state()).gameSession, { timeout: 10_000 })
    .toEqual({ status: "ready", error: null });
  await invoke("importSounds", [fixture]);
  const id = (await state()).config.sounds[0].id;
  await invoke("play", id);
  await expect.poll(async () => (await state()).game.status).toBe("playing");
  await expect.poll(level).toBeGreaterThan(0.005);
  expect((await state()).broadcast.status).toBe("idle");
  expect((await state()).local.status).toBe("idle");
  await invoke("stop");
  await expect.poll(level).toBeLessThan(0.0001);
  results.push(
    "WAV réellement décodé et signal mesuré dans le mixeur Web Audio ; jeu seul sans lecture Discord ou locale ; STOP coupe le signal",
  );
  await invoke("updateSound", id, { shortcut: "Control+Alt+F9" });
  expect((await state()).shortcuts.filter((item) => [id, "stop"].includes(item.soundId)).every((item) => item.status === "registered")).toBe(true);
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
  await exec("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolve("scripts/press-shortcut.ps1"), "-Key", "120"], { windowsHide: true });
  await expect.poll(async () => (await state()).game.status).toBe("playing");
  expect((await state()).broadcast.status).toBe("idle");
  await exec("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolve("scripts/press-shortcut.ps1"), "-Key", "121"], { windowsHide: true });
  await expect.poll(async () => (await state()).game.status).toBe("idle");
  await desktop.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.restore(); w.show(); w.focus(); });
  results.push("Raccourci global Ctrl+Alt+F9 et STOP Ctrl+Alt+F10 : lecture en jeu seul et arrêt avec fenêtre réduite");
  await invoke("play", id, true);
  await expect.poll(async () => (await state()).local.status).toBe("playing");
  expect((await state()).game.status).toBe("idle");
  expect(await level()).toBeLessThan(0.0001);
  await invoke("stop");
  results.push("Préécoute locale isolée du circuit de diffusion en jeu");
  // Select the new mode through the UI: prepare voice mixing, but require activation.
  await page.getByRole("group", { name: "Utilisation du micro virtuel" }).getByRole("button", { name: "Micro partout", exact: true }).click();
  await expect.poll(async () => (await state()).config.settings.output).toBe("micro");
  expect((await state()).config.settings.gameMicEnabled).toBe(true);
  await expect.poll(async () => (await state()).gameSession.status).toBe("off");
  expect(await page.evaluate(() => !!window.__testMic)).toBe(false);
  const notActive = await page.evaluate((id) => window.soundboard.play(id), id);
  expect(notActive.ok).toBe(false);
  expect(notActive.error).toContain("Activez le micro virtuel");
  await invoke("updateSettings", { gameMicrophoneId: "test-mic" });
  await page.getByRole("button", { name: "Activer Micro partout", exact: true }).click();
  await expect.poll(async () => (await state()).gameSession.status).toBe("ready");
  expect(await page.evaluate(() => window.__testMic.readyState)).toBe("live");
  await expect.poll(level).toBeGreaterThan(0.005);
  await expect(page.getByText(/désactivez vous-même la suppression du bruit/)).toBeVisible();
  expect((await state()).discord.status).toBe("offline");
  await invoke("updateSettings", { gameMicVolume: 0 });
  await expect.poll(level).toBeLessThan(0.0001);
  await invoke("play", id);
  await expect.poll(level).toBeGreaterThan(0.005);
  expect((await state()).broadcast.status).toBe("idle");
  expect((await state()).local.status).toBe("idle");
  await invoke("stop");
  await expect.poll(level).toBeLessThan(0.0001);
  await invoke("updateSettings", { gameMicVolume: 0.8 });
  await expect.poll(level).toBeGreaterThan(0.005);
  results.push("Micro partout : activation explicite, voix et sons mesurés, volumes indépendants, STOP conserve la voix, bot hors ligne et silencieux");
  await page.screenshot({ path: "test-results/09-micro-everywhere.png" });
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 640));
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: "test-results/09-micro-everywhere-small.png" });
  await page.getByRole("heading", { name: "3. Choisir le micro dans vos applications" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/09-micro-guide.png" });
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 840));
  await invoke("updateSettings", { output: "game", gameMicEnabled: false });
  await expect.poll(async () => (await state()).gameSession.status).toBe("off");
  expect(await page.evaluate(() => window.__testMic.readyState)).toBe("ended");
  results.push("Changer de mode libère le micro même entre Micro partout et En jeu");
  await page.getByRole("button", { name: "Activer le mode jeu", exact: true }).click();
  await expect.poll(async () => (await state()).gameSession.status).toBe("ready");
  await invoke("play", id);
  await expect.poll(level).toBeGreaterThan(0.005);
  await page.evaluate(() => {
    window.__testDevices = window.__testDevices.filter(
      (d) => d.deviceId !== "test-cable",
    );
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
  });
  await expect
    .poll(async () => (await state()).gameSession.status)
    .toBe("error");
  expect((await state()).game.status).toBe("idle");
  expect(await page.evaluate(() => window.__gameContext.state)).toBe("closed");
  results.push(
    "Débranchement simulé du câble : arrêt et fermeture du mixeur, aucun repli vers la sortie par défaut",
  );
  await page.evaluate(() => {
    window.__testDevices.push({
      kind: "audiooutput",
      deviceId: "test-cable",
      groupId: "cable",
      label: "CABLE Input (VB-Audio Virtual Cable)",
    });
  });
  await invoke("updateSettings", {
    gameMicEnabled: true,
    gameMicrophoneId: "test-mic",
    gameMonitorEnabled: true,
    gameMonitorId: "test-headset",
  });
  await page
    .getByRole("button", { name: "Activer le mode jeu", exact: true })
    .click();
  await expect
    .poll(async () => (await state()).gameSession, { timeout: 10_000 })
    .toEqual({ status: "ready", error: null });
  expect(await page.evaluate(() => window.__testMic.readyState)).toBe("live");
  const monitorLevel = () =>
    page.evaluate(() => {
      const a = window.__monitorAnalyser;
      const data = new Float32Array(a.fftSize);
      a.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
    });
  await expect.poll(level).toBeGreaterThan(0.005);
  expect(await monitorLevel()).toBeLessThan(0.0001);
  await invoke("updateSettings", { gameMicVolume: 0 });
  await expect.poll(level).toBeLessThan(0.0001);
  await invoke("play", id);
  await expect.poll(level).toBeGreaterThan(0.005);
  await expect.poll(monitorLevel).toBeGreaterThan(0.005);
  await invoke("stop");
  await expect.poll(monitorLevel).toBeLessThan(0.0001);
  results.push(
    "Micro artificiel audible dans le mixeur mais absent du retour casque ; son audible sur les deux ; volumes micro et sons indépendants",
  );
  const cameraDenied = await page.evaluate(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      return false;
    } catch {
      return true;
    }
  });
  expect(cameraDenied).toBe(true);
  results.push("Caméra refusée même pendant l’accès autorisé au micro");
  await invoke("updateSettings", { output: "discord" });
  await expect.poll(async () => (await state()).gameSession.status).toBe("off");
  expect(await page.evaluate(() => window.__testMic.readyState)).toBe("ended");
  results.push(
    "Capture du micro artificiel uniquement après activation ; passage à Discord libère la piste micro",
  );
  await invoke("updateSettings", { output: "micro" });
  await desktop.close();
  desktop = await electron.launch(launchOptions);
  page = await desktop.firstWindow();
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page.getByRole("heading", { name: "Votre bibliothèque de sons." })).toBeVisible();
  expect((await state()).config.settings).toMatchObject({ output: "micro", gameMicEnabled: true, gameMicrophoneId: "test-mic" });
  expect((await state()).gameSession.status).toBe("off");
  expect((await state()).broadcast.status).toBe("idle");
  await expect(page.getByRole("group", { name: "Destination de lecture" }).getByRole("button", { name: "Micro partout", exact: true })).toHaveClass("selected");
  await expect(page.getByRole("button", { name: "Jeu + Discord", exact: true })).toHaveCount(0);
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 640));
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: "test-results/09-micro-library-small.png" });
  expect(await page.evaluate(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return false;
    } catch { return true; }
  })).toBe(true);
  results.push("Après réouverture : Micro partout et ses réglages sont conservés, mais capture micro et diffusion restent désactivées");
  expect(errors).toEqual([]);
  const report = {
    date: new Date().toISOString(),
    results,
    driverState,
    rendererErrors: errors,
    limitations: [
      "Périphériques du mixeur simulés ; aucun vrai micro capturé.",
      "Installation du pilote avec UAC et boucle audio Windows physique non exercées.",
      "Aucune partie de jeu ni session Discord réelle utilisée.",
    ],
  };
  await writeFile(
    "test-results/game-smoke-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.log("Current state:", JSON.stringify(await state()));
  await page.screenshot({ path: "test-results/game-error.png" });
  throw error;
} finally {
  await desktop.close().catch(() => {});
}
