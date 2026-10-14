import { _electron as electron, expect } from "@playwright/test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { testWav } from "./test-audio.mjs";

const exec = promisify(execFile);
await mkdir(".test-data", { recursive: true });
await mkdir("test-results", { recursive: true });
const data = await mkdtemp(resolve(".test-data/desktop-"));
const fixtures = join(data, "fixtures");
await mkdir(fixtures);
const source = join(fixtures, "Signal de test.wav");
const mp3 = join(fixtures, "Victoire.mp3");
const ogg = join(fixtures, "Notification.ogg");
const encoded = JSON.parse(await readFile(new URL("../tests/audio-fixtures.json", import.meta.url), "utf8"));
await writeFile(source, testWav());
await writeFile(mp3, Buffer.from(encoded.mp3, "base64"));
await writeFile(ogg, Buffer.from(encoded.vorbis, "base64"));
const executablePath = process.env.SOUNDBOARD_TEST_EXE;
const results = [];
let desktop;
let page;
const rendererErrors = [];
async function launch() {
  const childEnv = { ...process.env, SOUNDBOARD_DATA_DIR: data };
  delete childEnv.ELECTRON_RUN_AS_NODE;
  desktop = await electron.launch({
    ...(executablePath ? { executablePath, args: [] } : { args: ["."] }),
    cwd: resolve("."),
    env: childEnv,
    timeout: 30_000,
  });
  page = await desktop.firstWindow();
  page.on("pageerror", (error) => rendererErrors.push(error.message));
  await expect(
    page.getByRole("heading", { name: "Votre bibliothèque de sons." }),
  ).toBeVisible();
  // Exercise real decoding without playing test tones through the user's speakers.
  await desktop.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].webContents.setAudioMuted(true);
  });
}
async function state() {
  const response = await page.evaluate(() => window.soundboard.getState());
  expect(response.ok).toBe(true);
  return response.value;
}
async function invoke(method, ...args) {
  const response = await page.evaluate(
    ({ method, args }) => window.soundboard[method](...args),
    { method, args },
  );
  expect(response.ok, response.error).toBe(true);
  return response.value;
}
try {
  await launch();
  await page.screenshot({ path: "test-results/01-empty.png" });
  const webSettings = await desktop.evaluate(({ BrowserWindow }) => {
    const prefs =
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      contextIsolation: prefs.contextIsolation,
      sandbox: prefs.sandbox,
      nodeIntegration: prefs.nodeIntegration,
    };
  });
  expect(webSettings).toEqual({
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
  });
  expect(await page.evaluate(() => typeof window.require)).toBe("undefined");
  results.push("Démarrage Windows et isolation de l’interface");
  // Simulate only the OS file picker selection; exercise the real UI and import pipeline.
  await desktop.evaluate(
    ({ dialog }, paths) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: paths,
      });
    },
    [source, mp3, ogg],
  );
  await page
    .getByRole("button", { name: "Importer des sons", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Jouer Signal de test", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => (await state()).config.sounds.length).toBe(3);
  results.push("Import multiple WAV, MP3 et OGG avec FFmpeg intégré");
  const first = (await state()).config.sounds[0];
  await page
    .getByRole("button", { name: "Modifier Signal de test", exact: true })
    .click();
  await page.getByLabel("Nom", { exact: true }).fill("Signal prêt");
  await page
    .getByLabel("Raccourci global", { exact: true })
    .fill("Control+Alt+9");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect
    .poll(
      async () =>
        (await state()).shortcuts.find((s) => s.soundId === first.id)?.status,
    )
    .toBe("registered");
  await page
    .getByRole("button", { name: "Jouer Signal prêt", exact: true })
    .click();
  await expect.poll(async () => (await state()).local.status).toBe("playing");
  await page
    .getByRole("button", { name: "STOP — arrêter tous les sons" })
    .click();
  await expect.poll(async () => (await state()).local.status).toBe("idle");
  results.push("Édition du nom, raccourci, lecture locale et STOP");
  for (const name of ["Victoire", "Notification"]) {
    await page
      .getByRole("button", { name: `Préécouter ${name}`, exact: true })
      .click();
    await expect.poll(async () => (await state()).local.status).toBe("playing");
    await invoke("stop");
  }
  results.push(
    "Préécoute réelle des trois formats (sortie volontairement muette pendant les essais)",
  );
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.id = "drop-test-input";
    input.hidden = true;
    document.body.append(input);
  });
  await page.locator("#drop-test-input").setInputFiles(source);
  await page.evaluate(() => {
    const input = document.querySelector("#drop-test-input");
    const transfer = new DataTransfer();
    transfer.items.add(input.files[0]);
    document
      .querySelector(".app")
      .dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
    input.remove();
  });
  await expect.poll(async () => (await state()).config.sounds.length).toBe(4);
  await page
    .getByRole("button", { name: "Modifier Signal de test", exact: true })
    .click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmer la suppression", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await state()).config.sounds).toHaveLength(3);
  results.push(
    "Import par événement de dépôt avec un vrai fichier Windows, puis suppression du bouton",
  );
  await invoke("updateSettings", { interrupt: false });
  await invoke("play", first.id);
  const overlapping = await page.evaluate(
    (id) => window.soundboard.play(id),
    first.id,
  );
  expect(overlapping.ok).toBe(false);
  await invoke("stop");
  await invoke("updateSettings", { interrupt: true });
  const other = (await state()).config.sounds[1];
  const duplicate = await page.evaluate(
    (id) => window.soundboard.updateSound(id, { shortcut: "Alt+Ctrl+9" }),
    other.id,
  );
  expect(duplicate.ok).toBe(false);
  expect(duplicate.error).toContain("déjà utilisé");
  results.push("Refus du chevauchement et des doublons de raccourcis");
  await desktop.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].minimize();
  });
  await exec(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolve("scripts/press-shortcut.ps1"),
    ],
    { windowsHide: true },
  );
  await expect
    .poll(async () => (await state()).local.status, { timeout: 5000 })
    .toBe("playing");
  await exec(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolve("scripts/press-shortcut.ps1"),
      "-Key",
      "48",
    ],
    { windowsHide: true },
  );
  await expect.poll(async () => (await state()).local.status).toBe("idle");
  results.push(
    "Raccourci global Ctrl+Alt+9 et STOP Ctrl+Alt+0 envoyés par Windows, fenêtre réduite",
  );
  await desktop.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.restore();
    window.show();
    window.focus();
  });
  await invoke("updateSettings", { shortcutsEnabled: false });
  expect((await state()).shortcuts.every((s) => s.status === "disabled")).toBe(
    true,
  );
  await invoke("updateSettings", { shortcutsEnabled: true });
  await page
    .getByRole("button", { name: "Créer un profil", exact: true })
    .click();
  await page.getByLabel("Nom du profil").fill("En jeu");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await state()).shortcuts).toHaveLength(1);
  await page.getByRole("button", { name: /Mon soundboard/ }).click();
  await invoke("updateSound", other.id, {
    favorite: true,
    icon: "🏆",
    color: "#f6bf73",
  });
  await page.getByLabel("Rechercher un son").fill("Signal");
  await expect(
    page.getByRole("button", { name: "Jouer Victoire", exact: true }),
  ).not.toBeVisible();
  await page.getByLabel("Rechercher un son").fill("");
  const ids = (await state()).config.sounds.map((s) => s.id).reverse();
  await invoke("reorderSounds", ids);
  expect((await state()).config.sounds.map((s) => s.id)).toEqual(ids);
  results.push(
    "Profils, restauration des raccourcis, recherche, favoris et réorganisation",
  );
  await page.screenshot({ path: "test-results/02-library.png" });
  await page
    .getByRole("button", { name: "Connexion Discord", exact: true })
    .click();
  await page
    .getByLabel("Token du bot", { exact: true })
    .fill("FAKE.TEST.TOKEN_FOR_ENCRYPTION_ONLY");
  await page
    .getByLabel("Application ID", { exact: true })
    .fill("123456789012345678");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect.poll(async () => (await state()).tokenStored).toBe(true);
  expect(
    (await readFile(join(data, "bot-token.bin"))).includes(
      "FAKE.TEST.TOKEN_FOR_ENCRYPTION_ONLY",
    ),
  ).toBe(false);
  expect(
    (await readFile(join(data, "config.json"), "utf8")).includes(
      "FAKE.TEST.TOKEN_FOR_ENCRYPTION_ONLY",
    ),
  ).toBe(false);
  expect(JSON.stringify(await state())).not.toContain(
    "FAKE.TEST.TOKEN_FOR_ENCRYPTION_ONLY",
  );
  expect(
    await page.getByLabel("Token du bot", { exact: true }).inputValue(),
  ).toBe("");
  results.push(
    "Chiffrement réel safeStorage/DPAPI, token absent de la configuration et des réponses IPC",
  );
  await page.screenshot({ path: "test-results/03-discord.png" });
  const dep = await desktop.evaluate(async ({ app }) => {
    const { createRequire } = process.getBuiltinModule("module");
    const require = createRequire(`${app.getAppPath()}/package.json`);
    const dave = require("@snazzah/davey");
    const session = new dave.DAVESession(
      dave.DAVE_PROTOCOL_VERSION,
      "123456789012345678",
      "234567890123456789",
    );
    const keyLength = session.getSerializedKeyPackage().length;
    session.reset();
    return {
      daveVersion: dave.DAVE_PROTOCOL_VERSION,
      keyLength,
      electron: process.versions.electron,
      node: process.versions.node,
    };
  });
  expect(dep.daveVersion).toBeGreaterThanOrEqual(1);
  expect(dep.keyLength).toBeGreaterThan(0);
  results.push(
    `DAVE natif chargé sous Electron ${dep.electron} / Node ${dep.node}, paquet de clés créé`,
  );
  await page.getByRole("button", { name: "Paramètres", exact: true }).click();
  await page.screenshot({ path: "test-results/04-settings.png" });
  await desktop.close();
  desktop = undefined;
  await launch();
  const restored = await state();
  expect(restored.config.sounds).toHaveLength(3);
  expect(restored.tokenStored).toBe(true);
  expect(restored.shortcuts.find((s) => s.soundId === first.id)?.status).toBe(
    "registered",
  );
  await invoke("play", first.id);
  await expect.poll(async () => (await state()).local.status).toBe("playing");
  await invoke("stop");
  await invoke("removeToken");
  results.push(
    "Redémarrage : fichiers copiés, profils, réglages, token et raccourcis persistants",
  );
  await desktop.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setSize(900, 640);
  });
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({ path: "test-results/05-small.png" });
  await invoke("updateSettings", { output: "discord" });
  const noVoice = await page.evaluate(
    (id) => window.soundboard.play(id),
    first.id,
  );
  expect(noVoice.ok).toBe(false);
  expect(noVoice.error).toContain("salon vocal");
  await invoke("updateSettings", { output: "local" });
  expect(rendererErrors).toEqual([]);
  results.push(
    "Fenêtre 900 × 640, aucune erreur React et message explicite si le bot est hors vocal",
  );
  const report = {
    date: new Date().toISOString(),
    executable: executablePath ?? "Electron développement (build production)",
    results,
    rendererErrors,
    manualRemaining: [
      "Connexion réelle à Discord et chiffrement négocié",
      "Audibilité pour un autre participant",
      "Krisp sur le microphone du compte personnel",
      "Valorant/Vanguard et plein écran exclusif",
      "Installation NSIS et démarrage Windows",
    ],
  };
  const reportFile = executablePath?.includes("-portable.exe")
    ? "test-results/portable-smoke.json"
    : executablePath
      ? "test-results/packaged-smoke.json"
      : "test-results/desktop-smoke.json";
  await writeFile(reportFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: "test-results/failure.png" }).catch(() => {});
  console.error("Tests déjà réussis :", results);
  throw error;
} finally {
  if (desktop) await desktop.close();
}
