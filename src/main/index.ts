import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  globalShortcut,
  safeStorage,
  protocol,
  net,
  shell,
  Menu,
  Tray,
  nativeImage,
  session,
} from "electron";
import { join, resolve, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { z } from "zod";
import {
  Id,
  Snowflake,
  soundPatchSchema,
  settingsPatchSchema,
  offlineDiscord,
  idlePlayback,
  gameSessionSchema,
  type AppEvent,
  type AppState,
  type Sound,
  type ChannelInfo,
  type Result,
  type GameSession,
} from "../shared/model";
import { publicError, UserError } from "../shared/errors";
import { normalizeShortcut } from "../shared/shortcuts";
import { ConfigStore, TokenVault } from "./store";
import { ShortcutManager } from "./shortcuts";
import { LocalPlayback } from "./local-playback";
import { AudioLibrary } from "./audio-library";
import { EngineBridge } from "./engine-bridge";
import { VirtualDriver } from "./virtual-driver";
import { destinations } from "../shared/routing";

app.setName("Local Discord Soundboard");
const customData = process.env.SOUNDBOARD_DATA_DIR;
if (customData && isAbsolute(customData)) app.setPath("userData", customData);
else
  app.setPath(
    "userData",
    join(app.getPath("appData"), "Local Discord Soundboard"),
  );
protocol.registerSchemesAsPrivileged([
  {
    scheme: "soundboard",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();

let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let suspended = false;
let store: ConfigStore;
let vault: TokenVault;
let library: AudioLibrary;
let shortcuts: ShortcutManager;
let local: LocalPlayback;
let game: LocalPlayback;
let driver: VirtualDriver;
let gameSession: GameSession = { status: "off", error: null };
let microphoneAllowed = false;
let playGeneration = 0;
let engine: EngineBridge;
let discord = offlineDiscord();
let broadcast = idlePlayback();
let shortcutState: AppState["shortcuts"] = [];
let tokenStored = false;
const devUrl =
  !app.isPackaged && process.env.SOUNDBOARD_DEV_URL === "http://127.0.0.1:5173"
    ? process.env.SOUNDBOARD_DEV_URL
    : undefined;
const rendererPath = join(__dirname, "../renderer/index.html");
const rendererUrl = devUrl ?? pathToFileURL(rendererPath).href;
const startupAvailable = app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR;
function emit(event: AppEvent): void {
  if (window && !window.isDestroyed())
    window.webContents.send("soundboard:event", event);
}
function snapshot(): AppState {
  return {
    config: store.value,
    discord,
    broadcast,
    local: local.state,
    game: game.state,
    gameSession,
    driver: driver.state,
    shortcuts: shortcutState,
    tokenStored,
    encryptionAvailable: vault.available(),
    storageWarning: store.warning,
    importing: library.importing,
    startupAvailable,
    version: app.getVersion(),
  };
}
function changed(): void {
  if (store && local && library) emit({ type: "state", state: snapshot() });
}
function notice(
  message: string,
  level: "error" | "success" | "info" = "error",
): void {
  emit({ type: "notice", level, message });
}
function safely(promise: Promise<unknown>): void {
  void promise.catch((error) => notice(publicError(error)));
}
function findSound(id: string): Sound {
  const sound = store.value.sounds.find((s) => s.id === id);
  if (!sound) throw new UserError("Ce son n’existe plus.");
  return sound;
}
function restoreShortcuts(): void {
  shortcutState = shortcuts.restore(store.value, suspended);
}
async function stop(): Promise<void> {
  ++playGeneration;
  local.stop();
  game.stop();
  await engine.request({ type: "stop" });
}
function disableGame(): void {
  microphoneAllowed = false;
  gameSession = { status: "off", error: null };
  game?.stop();
  emit({ type: "gameDisabled" });
  changed();
}
async function play(id: string, preview = false): Promise<void> {
  const sound = findSound(id);
  const settings = store.value.settings;
  const volume = sound.volume * settings.masterVolume;
  const route = destinations(settings.output, preview);
  if (route.game && gameSession.status !== "ready")
    throw new UserError(
      "Activez le mode jeu dans la page En jeu avant de diffuser un son.",
    );
  if (route.discord && discord.voice !== "ready")
    throw new UserError(
      "Connectez le bot à un salon vocal Discord avant de diffuser.",
    );
  if (
    !settings.interrupt &&
    ((route.game && game.state.status !== "idle") ||
      (route.discord && broadcast.status !== "idle"))
  )
    throw new UserError(
      "Un son est déjà en cours. Appuyez sur STOP ou activez le remplacement de la lecture.",
    );
  const generation = route.local ? playGeneration : ++playGeneration;
  if (route.local) local.play(sound, volume, settings.interrupt);
  if (route.discord)
    await engine.request({
      type: "play",
      soundId: id,
      name: sound.name,
      path: library.path(sound),
      volume,
      interrupt: settings.interrupt,
    });
  if (
    route.game &&
    generation === playGeneration &&
    gameSession.status === "ready"
  )
    game.play(sound, volume, settings.interrupt);
}
async function syncVolumes(): Promise<void> {
  const { settings, sounds } = store.value;
  const gain = (id: string | null) =>
    settings.masterVolume * (sounds.find((s) => s.id === id)?.volume ?? 1);
  local.setVolume(gain(local.state.soundId));
  game.setVolume(gain(game.state.soundId));
  if (broadcast.status !== "idle")
    await engine.request({ type: "volume", volume: gain(broadcast.soundId) });
}

function registerIpc(): void {
  ipcMain.handle(
    "soundboard:invoke",
    async (event, request: unknown): Promise<Result<unknown>> => {
      try {
        if (
          !window ||
          event.sender !== window.webContents ||
          event.senderFrame !== window.webContents.mainFrame
        )
          throw new UserError("Accès refusé.");
        const url = event.senderFrame.url;
        if (devUrl ? new URL(url).origin !== devUrl : url !== rendererUrl)
          throw new UserError("Origine non autorisée.");
        const { action, data } = z
          .object({ action: z.string(), data: z.unknown().optional() })
          .strict()
          .parse(request);
        let value: unknown;
        switch (action) {
          case "state":
            value = snapshot();
            break;
          case "import": {
            const paths = z.array(z.string().min(1)).optional().parse(data);
            const selected =
              paths ??
              (
                await dialog.showOpenDialog(window, {
                  title: "Importer des sons",
                  properties: ["openFile", "multiSelections"],
                  filters: [
                    {
                      name: "Fichiers audio",
                      extensions: ["mp3", "wav", "ogg"],
                    },
                  ],
                })
              ).filePaths;
            value = await library.import(selected);
            restoreShortcuts();
            changed();
            break;
          }
          case "sound:update": {
            const { id, patch } = z
              .object({ id: Id, patch: soundPatchSchema })
              .strict()
              .parse(data);
            if (patch.shortcut !== undefined)
              patch.shortcut = normalizeShortcut(patch.shortcut);
            findSound(id);
            await store.change((config) => {
              Object.assign(config.sounds.find((s) => s.id === id)!, patch);
            });
            restoreShortcuts();
            changed();
            await syncVolumes();
            break;
          }
          case "sound:delete": {
            const id = Id.parse(data);
            findSound(id);
            if (local.state.soundId === id) local.stop();
            if (game.state.soundId === id) game.stop();
            if (broadcast.soundId === id)
              await engine.request({ type: "stop" });
            await store.change((config) => {
              config.sounds = config.sounds.filter((s) => s.id !== id);
            });
            // Keep the owned file so the .bak configuration remains recoverable.
            restoreShortcuts();
            changed();
            break;
          }
          case "sound:reorder": {
            const ids = z.array(Id).parse(data);
            await store.change((config) => {
              const sounds = config.sounds.filter(
                (s) => s.profileId === config.activeProfileId,
              );
              if (
                ids.length !== sounds.length ||
                new Set(ids).size !== ids.length ||
                ids.some((id) => !sounds.some((s) => s.id === id))
              )
                throw new UserError("Ordre des sons invalide.");
              const ordered = ids.map((id) => sounds.find((s) => s.id === id)!);
              let i = 0;
              config.sounds = config.sounds.map((s) =>
                s.profileId === config.activeProfileId ? ordered[i++]! : s,
              );
            });
            changed();
            break;
          }
          case "profile:create": {
            const name = z.string().trim().min(1).max(50).parse(data);
            await store.change((config) => {
              const id = randomUUID();
              config.profiles.push({ id, name });
              config.activeProfileId = id;
            });
            restoreShortcuts();
            changed();
            break;
          }
          case "profile:rename": {
            const { id, name } = z
              .object({ id: Id, name: z.string().trim().min(1).max(50) })
              .strict()
              .parse(data);
            await store.change((config) => {
              const profile = config.profiles.find((p) => p.id === id);
              if (!profile) throw new UserError("Profil introuvable.");
              profile.name = name;
            });
            changed();
            break;
          }
          case "profile:delete": {
            const id = Id.parse(data);
            await store.change((config) => {
              if (config.profiles.length <= 1)
                throw new UserError("Conservez au moins un profil.");
              if (!config.profiles.some((p) => p.id === id))
                throw new UserError("Profil introuvable.");
              if (config.sounds.some((s) => s.profileId === id))
                throw new UserError(
                  "Déplacez ou supprimez les sons de ce profil avant de le supprimer.",
                );
              config.profiles = config.profiles.filter((p) => p.id !== id);
              if (config.activeProfileId === id)
                config.activeProfileId = config.profiles[0]!.id;
            });
            restoreShortcuts();
            changed();
            break;
          }
          case "profile:select": {
            const id = Id.parse(data);
            await store.change((config) => {
              if (!config.profiles.some((p) => p.id === id))
                throw new UserError("Profil introuvable.");
              config.activeProfileId = id;
            });
            restoreShortcuts();
            changed();
            break;
          }
          case "settings": {
            const patch = settingsPatchSchema.parse(data);
            const before = store.value.settings;
            if (patch.launchAtLogin && !startupAvailable)
              throw new UserError(
                "Le démarrage avec Windows nécessite la version installée, conservée au même emplacement.",
              );
            if (patch.stopShortcut !== undefined)
              patch.stopShortcut = normalizeShortcut(patch.stopShortcut);
            if (
              patch.output !== undefined &&
              patch.output !== store.value.settings.output
            )
              await stop();
            await store.change((config) => {
              Object.assign(config.settings, patch);
              if (config.settings.followUser && !config.settings.userId)
                throw new UserError(
                  "Renseignez votre identifiant Discord avant d’activer le suivi.",
                );
            });
            if (
              [
                "gameOutputId",
                "gameMicrophoneId",
                "gameMicEnabled",
                "gameMonitorId",
                "gameMonitorEnabled",
              ].some(
                (key) =>
                  key in patch &&
                  patch[key as keyof typeof patch] !==
                    before[key as keyof typeof before],
              ) ||
              (patch.output !== undefined && !destinations(patch.output).game)
            )
              disableGame();
            if (patch.launchAtLogin !== undefined)
              app.setLoginItemSettings({
                openAtLogin: patch.launchAtLogin,
                path: process.execPath,
              });
            restoreShortcuts();
            changed();
            await syncVolumes();
            if (patch.followUser !== undefined || patch.userId !== undefined) {
              const settings = store.value.settings;
              await engine.request({
                type: "follow",
                userId: settings.userId,
                enabled: settings.followUser,
              });
            }
            break;
          }
          case "play": {
            const input = z
              .object({ id: Id, preview: z.boolean() })
              .strict()
              .parse(data);
            await play(input.id, input.preview);
            break;
          }
          case "stop":
            await stop();
            break;
          case "local:status": {
            const input = z
              .object({
                requestId: z.number().int().nonnegative(),
                status: z.enum(["playing", "ended", "error"]),
              })
              .strict()
              .parse(data);
            if (local.report(input.requestId, input.status))
              notice(
                "Préécoute impossible. Vérifiez le fichier et choisissez votre casque dans la page En jeu si le composant audio virtuel est installé.",
              );
            break;
          }
          case "game:status": {
            const input = z
              .object({
                requestId: z.number().int().nonnegative(),
                status: z.enum(["playing", "ended", "error"]),
              })
              .strict()
              .parse(data);
            if (game.report(input.requestId, input.status)) {
              notice(
                "Lecture en jeu impossible. Vérifiez le fichier audio et le périphérique virtuel.",
              );
              if (store.value.settings.output === "both")
                await engine.request({ type: "stop" });
            }
            break;
          }
          case "game:session": {
            gameSession = gameSessionSchema.parse(data);
            if (gameSession.status !== "ready") game.stop();
            if (gameSession.status === "error") {
              if (store.value.settings.output === "both")
                await engine.request({ type: "stop" });
              notice(gameSession.error || "Le mode jeu s’est arrêté.");
            }
            changed();
            break;
          }
          case "game:microphone":
            microphoneAllowed = z.boolean().parse(data);
            break;
          case "driver:refresh":
            value = await driver.refresh();
            break;
          case "driver:install":
            disableGame();
            await stop();
            value = await driver.install();
            break;
          case "token:save": {
            const token = z
              .string()
              .trim()
              .min(20)
              .max(500)
              .regex(/^\S+$/)
              .parse(data);
            await vault.save(token);
            tokenStored = true;
            changed();
            break;
          }
          case "token:remove":
            // Removing a credential must still work after a crashed/unavailable worker.
            await engine.request({ type: "disconnect" }).catch(() => {});
            await vault.remove();
            tokenStored = false;
            changed();
            break;
          case "discord:connect": {
            const settings = store.value.settings;
            await engine.request({
              type: "connect",
              token: await vault.read(),
              userId: settings.userId,
              followUser: settings.followUser,
            });
            break;
          }
          case "discord:disconnect":
            await engine.request({ type: "disconnect" });
            break;
          case "discord:channels":
            value = await engine.request<ChannelInfo[]>({
              type: "channels",
              guildId: Snowflake.parse(data),
            });
            break;
          case "discord:join": {
            const input = z
              .object({ guildId: Snowflake, channelId: Snowflake })
              .strict()
              .parse(data);
            await engine.request({ type: "join", ...input });
            await store.change((config) => {
              config.settings.lastGuildId = input.guildId;
              config.settings.lastChannelId = input.channelId;
            });
            changed();
            break;
          }
          case "discord:leave":
            await engine.request({ type: "leave" });
            break;
          case "shortcuts:suspend":
            suspended = z.boolean().parse(data);
            restoreShortcuts();
            changed();
            break;
          case "open": {
            const link = z
              .enum([
                "portal",
                "invite",
                "guide",
                "data",
                "cable",
                "cableLicense",
                "cableDonate",
              ])
              .parse(data);
            if (link === "cable")
              await shell.openExternal("https://vb-audio.com/Cable/");
            else if (link === "cableLicense")
              await shell.openExternal(
                "https://vb-audio.com/Services/licensing.htm",
              );
            else if (link === "cableDonate")
              await shell.openExternal(
                "https://shop.vb-audio.com/en/win-apps/11-vb-cable.html",
              );
            else if (link === "portal")
              await shell.openExternal(
                "https://discord.com/developers/applications",
              );
            else if (link === "invite") {
              const id = store.value.settings.clientId;
              if (!id)
                throw new UserError(
                  "Renseignez l’Application ID pour générer le lien d’invitation.",
                );
              await shell.openExternal(
                `https://discord.com/oauth2/authorize?client_id=${id}&scope=bot&permissions=3146752`,
              );
            } else if (link === "data") await shell.openPath(store.root);
            else
              await shell.openPath(
                app.isPackaged
                  ? join(process.resourcesPath, "README.md")
                  : resolve("README.md"),
              );
            break;
          }
          default:
            throw new UserError("Action non autorisée.");
        }
        return { ok: true, value };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof z.ZodError
              ? "Valeur invalide. Vérifiez les champs saisis."
              : publicError(error),
        };
      }
    },
  );
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#101319",
    title: "Local Discord Soundboard",
    autoHideMenuBar: true,
    icon: join(__dirname, "../icon.png"),
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  Menu.setApplicationMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.webContents.on("render-process-gone", () => {
    local.stop();
    disableGame();
    notice("L’interface a été interrompue. Redémarrez l’application.");
  });
  window.webContents.on("did-finish-load", () => {
    local.stop();
    disableGame();
    changed();
  });
  window.on("ready-to-show", () => window?.show());
  window.on("blur", () => {
    if (suspended) {
      suspended = false;
      restoreShortcuts();
      changed();
    }
  });
  window.on("close", (event) => {
    if (!quitting && store.value.settings.minimizeToTray && tray) {
      event.preventDefault();
      window?.hide();
    } else if (!quitting) {
      event.preventDefault();
      app.quit();
    }
  });
  window.on("closed", () => {
    window = null;
  });
  if (devUrl) void window.loadURL(devUrl);
  else void window.loadFile(rendererPath);
}

async function start(): Promise<void> {
  const ffmpeg = app.isPackaged
    ? join(process.resourcesPath, "ffmpeg/ffmpeg.exe")
    : join(app.getAppPath(), "vendor/ffmpeg/ffmpeg.exe");
  try {
    await access(ffmpeg);
  } catch {
    throw new UserError(
      "FFmpeg est introuvable. Réinstallez l’application ou exécutez le script d’installation des composants.",
    );
  }
  store = new ConfigStore(app.getPath("userData"));
  await store.load();
  vault = new TokenVault(join(store.root, "bot-token.bin"), {
    available: () =>
      safeStorage.isEncryptionAvailable() &&
      (process.platform !== "linux" ||
        safeStorage.getSelectedStorageBackend() !== "basic_text"),
    encrypt: (value) => safeStorage.encryptString(value),
    decrypt: (value) => safeStorage.decryptString(value),
  });
  tokenStored = await vault.present();
  local = new LocalPlayback(
    (event) => emit({ type: "localAudio", event }),
    changed,
  );
  game = new LocalPlayback(
    (event) => emit({ type: "gameAudio", event }),
    changed,
  );
  driver = new VirtualDriver(
    app.isPackaged
      ? join(process.resourcesPath, "vb-cable/VBCABLE_Driver_Pack45.zip")
      : join(app.getAppPath(), "vendor/vb-cable/VBCABLE_Driver_Pack45.zip"),
    join(store.root, "components"),
    changed,
  );
  library = new AudioLibrary(store, ffmpeg, changed);
  engine = new EngineBridge(join(__dirname, "worker.cjs"), ffmpeg, (event) => {
    if (event.type === "discord") discord = event.state;
    if (event.type === "playback") broadcast = event.state;
    if (event.type === "error") {
      notice(event.message);
      if (event.message.includes("moteur Discord s’est arrêté")) {
        discord = offlineDiscord();
        broadcast = idlePlayback();
      }
    }
    changed();
  });
  shortcuts = new ShortcutManager(
    globalShortcut,
    (id) => safely(play(id)),
    () => safely(stop()),
  );
  const trustedMedia = (
    contents: Electron.WebContents | null,
    url?: string,
    mainFrame?: boolean,
  ) =>
    !!window &&
    contents === window.webContents &&
    mainFrame !== false &&
    (devUrl
      ? contents.getURL().startsWith(`${devUrl}/`)
      : contents.getURL() === rendererUrl) &&
    (!url || (devUrl ? url.startsWith(`${devUrl}/`) : url === rendererUrl));
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback, details) => {
      const trusted = trustedMedia(
        contents,
        details.requestingUrl,
        details.isMainFrame,
      );
      callback(
        trusted &&
          (permission === "speaker-selection" ||
            (permission === "media" &&
              microphoneAllowed &&
              "mediaTypes" in details &&
              !!details.mediaTypes?.length &&
              details.mediaTypes.every((type) => type === "audio"))),
      );
    },
  );
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission, _origin, details) =>
      trustedMedia(contents, details.requestingUrl, details.isMainFrame) &&
      (permission === "speaker-selection" ||
        (permission === "media" &&
          microphoneAllowed &&
          details.mediaType !== "video")),
  );
  protocol.handle("soundboard", async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== "audio" || !["GET", "HEAD"].includes(request.method))
        return new Response(null, { status: 403 });
      const id = Id.parse(url.pathname.slice(1));
      const sound = findSound(id);
      const response = await net.fetch(
        pathToFileURL(library.path(sound)).href,
        {
          method: request.method,
          headers: request.headers,
        },
      );
      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", devUrl || "null");
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  registerIpc();
  createWindow();
  void driver.refresh();
  tray = new Tray(
    nativeImage
      .createFromPath(join(__dirname, "../icon.png"))
      .resize({ width: 24, height: 24 }),
  );
  tray.setToolTip(
    "Local Discord Soundboard — raccourcis actifs selon le profil",
  );
  const show = () => {
    if (!window) createWindow();
    window?.show();
    window?.focus();
  };
  tray.on("double-click", show);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Ouvrir la soundboard", click: show },
      { label: "STOP — tout arrêter", click: () => safely(stop()) },
      { type: "separator" },
      { label: "Quitter", click: () => app.quit() },
    ]),
  );
  restoreShortcuts();
  app.on("second-instance", show);
  app.on("activate", show);
}
app.on("window-all-closed", () => {
  if (!tray || !store?.value.settings.minimizeToTray) app.quit();
});
app.on("before-quit", (event) => {
  if (quitting) return;
  quitting = true;
  event.preventDefault();
  shortcuts?.dispose();
  local?.stop();
  disableGame();
  tray?.destroy();
  tray = null;
  void (async () => {
    await engine?.dispose();
    app.quit();
  })();
});
if (locked) {
  void app
    .whenReady()
    .then(start)
    .catch((error) => {
      dialog.showErrorBox(
        "Impossible de démarrer la soundboard",
        publicError(error),
      );
      app.quit();
    });
}
