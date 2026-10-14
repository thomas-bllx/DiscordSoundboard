import {
  Client,
  GatewayIntentBits,
  Events,
  ChannelType,
  PermissionFlagsBits,
  type VoiceState,
} from "discord.js";
import {
  joinVoiceChannel,
  entersState,
  VoiceConnectionStatus,
  type VoiceConnection,
} from "@discordjs/voice";
import { DAVE_PROTOCOL_VERSION } from "@snazzah/davey";
import {
  offlineDiscord,
  type DiscordState,
  type ChannelInfo,
} from "../shared/model";
import { UserError } from "../shared/errors";
import type { BroadcastPlayback } from "./playback";

const requiredPermissions = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
];
export class DiscordEngine {
  state: DiscordState = offlineDiscord();
  private client: Client | null = null;
  private connection: VoiceConnection | null = null;
  private session = 0;
  private joinSequence = 0;
  private userId = "";
  private followUser = false;
  constructor(
    private playback: BroadcastPlayback,
    private changed: (state: DiscordState) => void,
    private error: (message: string) => void,
  ) {}
  private update(patch: Partial<DiscordState>): void {
    this.state = { ...this.state, ...patch };
    this.changed(this.state);
  }
  async connect(
    token: string,
    userId: string,
    followUser: boolean,
  ): Promise<void> {
    const generation = ++this.session;
    this.leave();
    const previous = this.client;
    this.client = null;
    await previous?.destroy();
    if (generation !== this.session) throw new UserError("Connexion annulée.");
    this.userId = userId;
    this.followUser = followUser;
    if (DAVE_PROTOCOL_VERSION < 1)
      throw new UserError(
        "Le composant DAVE est indisponible. Réinstallez l’application.",
      );
    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
      rest: { timeout: 15_000, retries: 1 },
    });
    this.client = client;
    this.update({ status: "connecting", error: null, dave: true });
    const active = () => this.client === client && this.session === generation;
    const guilds = () =>
      [...client.guilds.cache.values()]
        .map((g) => ({ id: g.id, name: g.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    client.on(Events.Error, () => {
      if (active())
        this.error(
          "Discord a signalé une erreur réseau. Vérifiez votre connexion.",
        );
    });
    client.on(Events.ShardError, () => {
      if (active())
        this.error(
          "Connexion Discord interrompue. Une reconnexion automatique est en cours.",
        );
    });
    client.on(Events.ShardReconnecting, () => {
      if (!active()) return;
      this.playback.stop();
      this.update({ status: "reconnecting" });
    });
    client.on(Events.ShardResume, () => {
      if (active()) this.update({ status: "online", error: null });
    });
    client.on(Events.ShardReady, () => {
      if (active() && client.isReady())
        this.update({ status: "online", error: null });
    });
    client.on(Events.ShardDisconnect, () => {
      if (!active()) return;
      this.leave();
      this.update({
        status: "reconnecting",
        error:
          "Connexion Discord perdue. Reconnectez le bot si elle ne revient pas.",
      });
    });
    client.on(Events.Invalidated, () => {
      if (!active()) return;
      void this.disconnect();
      this.error(
        "La session du bot a expiré. Reconnectez-le avec un token valide.",
      );
    });
    client.on(Events.GuildCreate, () => {
      if (active()) this.update({ guilds: guilds() });
    });
    client.on(Events.GuildDelete, (guild) => {
      if (!active()) return;
      if (this.state.guildId === guild.id) this.leave();
      this.update({ guilds: guilds() });
    });
    client.on(Events.VoiceStateUpdate, (oldState, newState) => {
      if (!active()) return;
      if (
        newState.id === client.user?.id &&
        oldState.channelId &&
        !newState.channelId
      )
        this.leave();
      if (
        newState.id === client.user?.id &&
        newState.channelId &&
        this.connection
      ) {
        this.update({
          channelId: newState.channelId,
          channelName: newState.channel?.name ?? "",
          guildId: newState.guild.id,
        });
        if (newState.serverMute) {
          this.playback.stop();
          this.error(
            "Le bot a été rendu muet sur le serveur. Un modérateur doit réactiver sa voix.",
          );
        }
      }
      if (
        this.followUser &&
        this.userId &&
        newState.id === this.userId &&
        oldState.channelId !== newState.channelId
      ) {
        void this.follow(newState).catch((error) =>
          this.error(
            error instanceof UserError
              ? error.message
              : "Impossible de suivre ce salon vocal.",
          ),
        );
      }
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const ready = new Promise<void>((resolve) =>
        client.once(Events.ClientReady, () => resolve()),
      );
      await Promise.race([
        (async () => {
          await client.login(token);
          await ready;
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), 30_000);
        }),
      ]);
      if (!active()) throw new UserError("Connexion annulée.");
      this.update({
        status: "online",
        botName: client.user?.tag ?? "Bot Discord",
        guilds: guilds(),
        error: null,
      });
      if (this.followUser && this.userId) {
        await this.followCurrent().catch((error) =>
          this.error(
            error instanceof UserError
              ? error.message
              : "Impossible de suivre votre salon vocal.",
          ),
        );
      }
    } catch (error) {
      if (!active()) throw new UserError("Connexion annulée.");
      await this.disconnect();
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : undefined;
      const message =
        code === "TokenInvalid" || code === 4004
          ? "Token du bot incorrect ou révoqué. Copiez un nouveau token depuis le Developer Portal."
          : "Connexion au bot impossible. Vérifiez le token, Internet et les réglages du bot dans le Developer Portal.";
      this.update({ error: message });
      throw new UserError(message);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async channels(guildId: string): Promise<ChannelInfo[]> {
    const client = this.client;
    if (!client?.isReady())
      throw new UserError("Connectez d’abord le bot Discord.");
    const guild = client.guilds.cache.get(guildId);
    if (!guild)
      throw new UserError(
        "Le bot n’a pas accès à ce serveur. Invitez-le d’abord.",
      );
    try {
      const channels = await guild.channels.fetch();
      const me = guild.members.me ?? (await guild.members.fetchMe());
      return [...channels.values()]
        .filter((c) => c?.type === ChannelType.GuildVoice)
        .sort((a, b) => a!.rawPosition - b!.rawPosition)
        .map((c) => ({
          id: c!.id,
          name: c!.name,
          accessible: c!.permissionsFor(me)?.has(requiredPermissions) ?? false,
        }));
    } catch (error) {
      if (error instanceof UserError) throw error;
      throw new UserError(
        "Impossible de charger les salons. Vérifiez les permissions du bot et la connexion.",
      );
    }
  }
  async join(guildId: string, channelId: string): Promise<void> {
    const client = this.client;
    if (!client?.isReady())
      throw new UserError("Connectez d’abord le bot Discord.");
    this.leave();
    const sequence = ++this.joinSequence;
    this.update({ voice: "joining", error: null });
    let connection: VoiceConnection | undefined;
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild)
        throw new UserError(
          "Bot absent du serveur. Utilisez le lien d’invitation.",
        );
      const channel = await guild.channels.fetch(channelId);
      const me = guild.members.me ?? (await guild.members.fetchMe());
      if (sequence !== this.joinSequence || this.client !== client)
        throw new UserError("Connexion au salon annulée.");
      if (!channel || channel.type !== ChannelType.GuildVoice)
        throw new UserError(
          "Choisissez un salon vocal classique. Les scènes et appels privés ne sont pas pris en charge.",
        );
      if (!channel.permissionsFor(me)?.has(requiredPermissions))
        throw new UserError(
          "Permissions manquantes : voir le salon, se connecter et parler.",
        );
      if (
        channel.userLimit > 0 &&
        channel.members.size >= channel.userLimit &&
        !channel.permissionsFor(me)?.has(PermissionFlagsBits.MoveMembers)
      ) {
        throw new UserError("Ce salon vocal est complet.");
      }
      connection = joinVoiceChannel({
        guildId,
        channelId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false,
        daveEncryption: true,
      });
      this.connection = connection;
      this.update({ guildId, channelId, channelName: channel.name });
      const current = () =>
        this.connection === connection && sequence === this.joinSequence;
      connection.on("error", () => {
        if (!current()) return;
        this.leave();
        this.error(
          "Erreur de connexion vocale ou DAVE. Rejoignez à nouveau le salon.",
        );
      });
      connection.on(VoiceConnectionStatus.Ready, () => {
        if (current()) this.update({ voice: "ready", error: null });
      });
      connection.on(VoiceConnectionStatus.Disconnected, () => {
        if (!current()) return;
        this.playback.stop();
        this.update({ voice: "reconnecting" });
        void entersState(
          connection!,
          VoiceConnectionStatus.Ready,
          15_000,
        ).catch(() => {
          if (!current()) return;
          this.leave();
          this.error(
            "Connexion au salon perdue. Vérifiez le réseau et rejoignez le salon à nouveau.",
          );
        });
      });
      connection.on(VoiceConnectionStatus.Destroyed, () => {
        if (current()) this.leave();
      });
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
      if (!current()) throw new UserError("Connexion au salon annulée.");
      connection.subscribe(this.playback.player);
      this.update({ voice: "ready", error: null });
    } catch (error) {
      if (sequence !== this.joinSequence)
        throw new UserError("Connexion au salon annulée.");
      this.leave();
      throw error instanceof UserError
        ? error
        : new UserError(
            "Salon inaccessible : vérifiez les permissions et l’accès réseau/UDP à Discord.",
          );
    }
  }
  leave(): void {
    ++this.joinSequence;
    this.playback.stop();
    const connection = this.connection;
    this.connection = null;
    if (
      connection &&
      connection.state.status !== VoiceConnectionStatus.Destroyed
    )
      connection.destroy();
    this.update({
      voice: "idle",
      guildId: null,
      channelId: null,
      channelName: "",
    });
  }
  async disconnect(): Promise<void> {
    ++this.session;
    this.leave();
    const client = this.client;
    this.client = null;
    this.update(offlineDiscord());
    await client?.destroy();
  }
  async setFollow(userId: string, enabled: boolean): Promise<void> {
    this.userId = userId;
    this.followUser = enabled;
    if (enabled && this.client?.isReady()) await this.followCurrent();
  }
  private async follow(state: VoiceState): Promise<void> {
    if (state.channelId && state.channel?.type === ChannelType.GuildVoice)
      await this.join(state.guild.id, state.channelId);
    else if (!state.channelId) await this.followCurrent();
    else this.leave();
  }
  private async followCurrent(): Promise<void> {
    for (const guild of this.client?.guilds.cache.values() ?? []) {
      const state = guild.voiceStates.cache.get(this.userId);
      if (state?.channelId && state.channel?.type === ChannelType.GuildVoice) {
        if (this.state.channelId !== state.channelId)
          await this.join(state.guild.id, state.channelId);
        return;
      }
    }
    this.leave();
  }
}
