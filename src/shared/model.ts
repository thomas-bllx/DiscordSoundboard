import { z } from "zod";

export const DEFAULT_PROFILE = "00000000-0000-4000-8000-000000000001";
export const Id = z.uuid();
export const Snowflake = z.string().regex(/^\d{17,20}$/);
export const Shortcut = z.string().max(80);
export const SoundSchema = z
  .object({
    id: Id,
    profileId: Id,
    name: z.string().trim().min(1).max(80),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    icon: z.string().max(16),
    file: z.string().regex(/^[0-9a-f-]{36}\.(mp3|wav|ogg)$/),
    shortcut: Shortcut,
    volume: z.number().min(0).max(1),
    duration: z.number().nonnegative().nullable(),
    favorite: z.boolean(),
  })
  .strict();
export const ProfileSchema = z
  .object({ id: Id, name: z.string().trim().min(1).max(50) })
  .strict();
export const SettingsSchema = z
  .object({
    masterVolume: z.number().min(0).max(1),
    output: z.enum(["local", "discord", "game", "both"]),
    gameOutputId: z.string().max(300),
    gameMicrophoneId: z.string().max(300),
    gameMicEnabled: z.boolean(),
    gameMicVolume: z.number().min(0).max(1),
    gameMonitorId: z.string().max(300),
    gameMonitorEnabled: z.boolean(),
    gameMonitorVolume: z.number().min(0).max(1),
    interrupt: z.boolean(),
    shortcutsEnabled: z.boolean(),
    stopShortcut: Shortcut,
    minimizeToTray: z.boolean(),
    launchAtLogin: z.boolean(),
    clientId: z.union([z.literal(""), Snowflake]),
    userId: z.union([z.literal(""), Snowflake]),
    followUser: z.boolean(),
    lastGuildId: z.union([z.literal(""), Snowflake]),
    lastChannelId: z.union([z.literal(""), Snowflake]),
  })
  .strict();
export const ConfigSchema = z
  .object({
    version: z.literal(2),
    profiles: z.array(ProfileSchema).min(1),
    activeProfileId: Id,
    sounds: z.array(SoundSchema),
    settings: SettingsSchema,
  })
  .strict()
  .superRefine((config, ctx) => {
    const profiles = new Set(config.profiles.map((p) => p.id));
    if (
      profiles.size !== config.profiles.length ||
      !profiles.has(config.activeProfileId) ||
      new Set(config.sounds.map((s) => s.id)).size !== config.sounds.length ||
      config.sounds.some(
        (s) => !profiles.has(s.profileId) || !s.file.startsWith(`${s.id}.`),
      )
    ) {
      ctx.addIssue({ code: "custom", message: "Bibliothèque incohérente." });
    }
  });
export type Sound = z.infer<typeof SoundSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export const soundPatchSchema = SoundSchema.pick({
  name: true,
  color: true,
  icon: true,
  shortcut: true,
  volume: true,
  profileId: true,
  favorite: true,
}).partial();
export type SoundPatch = z.infer<typeof soundPatchSchema>;
export const settingsPatchSchema = SettingsSchema.partial();

export const gameSessionSchema = z
  .object({
    status: z.enum(["off", "starting", "ready", "error"]),
    error: z.string().max(500).nullable(),
  })
  .strict();
export type GameSession = z.infer<typeof gameSessionSchema>;
export interface DriverState {
  status:
    | "checking"
    | "missing"
    | "installed"
    | "installing"
    | "restart"
    | "error";
  message: string;
}

export function readConfig(raw: unknown): Config {
  if (raw && typeof raw === "object" && "version" in raw && raw.version === 1) {
    const previous = raw as { settings?: object };
    return ConfigSchema.parse({
      ...raw,
      version: 2,
      settings: { ...defaultConfig().settings, ...previous.settings },
    });
  }
  return ConfigSchema.parse(raw);
}

export function defaultConfig(): Config {
  return {
    version: 2,
    profiles: [{ id: DEFAULT_PROFILE, name: "Mon soundboard" }],
    activeProfileId: DEFAULT_PROFILE,
    sounds: [],
    settings: {
      masterVolume: 0.7,
      output: "local",
      gameOutputId: "",
      gameMicrophoneId: "",
      gameMicEnabled: false,
      gameMicVolume: 0.8,
      gameMonitorId: "",
      gameMonitorEnabled: false,
      gameMonitorVolume: 0.5,
      interrupt: true,
      shortcutsEnabled: true,
      stopShortcut: "Control+Alt+0",
      minimizeToTray: true,
      launchAtLogin: false,
      clientId: "",
      userId: "",
      followUser: false,
      lastGuildId: "",
      lastChannelId: "",
    },
  };
}

export interface GuildInfo {
  id: string;
  name: string;
}
export interface ChannelInfo {
  id: string;
  name: string;
  accessible: boolean;
}
export interface DiscordState {
  status: "offline" | "connecting" | "online" | "reconnecting";
  voice: "idle" | "joining" | "ready" | "reconnecting";
  botName: string;
  guilds: GuildInfo[];
  guildId: string | null;
  channelId: string | null;
  channelName: string;
  error: string | null;
  dave: boolean;
}
export function offlineDiscord(): DiscordState {
  return {
    status: "offline",
    voice: "idle",
    botName: "",
    guilds: [],
    guildId: null,
    channelId: null,
    channelName: "",
    error: null,
    dave: false,
  };
}
export interface PlaybackState {
  status: "idle" | "loading" | "playing";
  soundId: string | null;
  name: string;
  requestId: number;
  startedAt: number | null;
}
export function idlePlayback(requestId = 0): PlaybackState {
  return {
    status: "idle",
    soundId: null,
    name: "",
    requestId,
    startedAt: null,
  };
}
export interface ShortcutStatus {
  soundId: string | "stop";
  shortcut: string;
  status: "registered" | "disabled" | "error";
  error?: string;
}
export interface AppState {
  config: Config;
  discord: DiscordState;
  local: PlaybackState;
  game: PlaybackState;
  gameSession: GameSession;
  driver: DriverState;
  broadcast: PlaybackState;
  shortcuts: ShortcutStatus[];
  tokenStored: boolean;
  encryptionAvailable: boolean;
  storageWarning: string | null;
  importing: boolean;
  startupAvailable: boolean;
  version: string;
}
export type LocalAudioEvent =
  | { type: "play"; sound: Sound; volume: number; requestId: number }
  | { type: "stop"; requestId: number }
  | { type: "volume"; volume: number };
export type AppEvent =
  | { type: "state"; state: AppState }
  | { type: "localAudio"; event: LocalAudioEvent }
  | { type: "gameAudio"; event: LocalAudioEvent }
  | { type: "gameDisabled" }
  | { type: "notice"; level: "error" | "success" | "info"; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface ImportReport {
  imported: number;
  failures: string[];
}
export interface DesktopApi {
  getState(): Promise<Result<AppState>>;
  importSounds(paths?: string[]): Promise<Result<ImportReport>>;
  pathsForFiles(files: File[]): string[];
  updateSound(id: string, patch: SoundPatch): Promise<Result<void>>;
  deleteSound(id: string): Promise<Result<void>>;
  reorderSounds(ids: string[]): Promise<Result<void>>;
  createProfile(name: string): Promise<Result<void>>;
  renameProfile(id: string, name: string): Promise<Result<void>>;
  deleteProfile(id: string): Promise<Result<void>>;
  selectProfile(id: string): Promise<Result<void>>;
  updateSettings(patch: Partial<Settings>): Promise<Result<void>>;
  play(id: string, preview?: boolean): Promise<Result<void>>;
  stop(): Promise<Result<void>>;
  reportLocal(
    requestId: number,
    status: "playing" | "ended" | "error",
  ): Promise<Result<void>>;
  reportGame(
    requestId: number,
    status: "playing" | "ended" | "error",
  ): Promise<Result<void>>;
  setGameSession(session: GameSession): Promise<Result<void>>;
  allowMicrophone(enabled: boolean): Promise<Result<void>>;
  refreshDriver(): Promise<Result<DriverState>>;
  installDriver(): Promise<Result<DriverState>>;
  saveToken(token: string): Promise<Result<void>>;
  removeToken(): Promise<Result<void>>;
  connect(): Promise<Result<void>>;
  disconnect(): Promise<Result<void>>;
  listChannels(guildId: string): Promise<Result<ChannelInfo[]>>;
  join(guildId: string, channelId: string): Promise<Result<void>>;
  leave(): Promise<Result<void>>;
  openLink(
    link:
      | "portal"
      | "invite"
      | "guide"
      | "data"
      | "cable"
      | "cableLicense"
      | "cableDonate",
  ): Promise<Result<void>>;
  suspendShortcuts(suspended: boolean): Promise<Result<void>>;
  onEvent(callback: (event: AppEvent) => void): () => void;
}
