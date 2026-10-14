import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { BroadcastPlayback } from "../src/engine/playback";

const fixtures = vi.hoisted(() => ({
  client: null as unknown,
  connection: null as unknown,
  join: vi.fn(),
  canSpeak: true,
  joinWait: null as Promise<unknown> | null,
}));
vi.mock("discord.js", async () => {
  const { EventEmitter } = await import("node:events");
  class Client extends EventEmitter {
    ready = false;
    user = { id: "123456789012345678", tag: "TestBot" };
    guilds = {
      cache: new Map([
        [
          "234567890123456789",
          {
            id: "234567890123456789",
            name: "Test server",
            channels: {
              fetch: vi.fn(async (id?: string) => {
                const channel = {
                  id: "345678901234567890",
                  name: "Vocal",
                  type: 2,
                  userLimit: 0,
                  members: new Map(),
                  rawPosition: 1,
                  permissionsFor: () => ({ has: () => fixtures.canSpeak }),
                };
                return id ? channel : new Map([[channel.id, channel]]);
              }),
            },
            members: { me: { id: "bot" } },
            voiceAdapterCreator: vi.fn(),
            voiceStates: { cache: new Map() },
          },
        ],
      ]),
    };
    constructor() {
      super();
      fixtures.client = this;
    }
    isReady() {
      return this.ready;
    }
    async login(token: string) {
      if (token === "invalid")
        throw Object.assign(new Error("Contains private secret"), {
          code: "TokenInvalid",
        });
      this.ready = true;
      this.emit("clientReady");
    }
    async destroy() {
      this.ready = false;
    }
  }
  return {
    Client,
    GatewayIntentBits: { Guilds: 1, GuildVoiceStates: 128 },
    ChannelType: { GuildVoice: 2 },
    PermissionFlagsBits: {
      ViewChannel: 1024n,
      Connect: 1048576n,
      Speak: 2097152n,
      MoveMembers: 16777216n,
    },
    Events: {
      ClientReady: "clientReady",
      Error: "error",
      ShardError: "shardError",
      ShardReconnecting: "reconnecting",
      ShardResume: "resumed",
      ShardReady: "ready",
      ShardDisconnect: "disconnect",
      Invalidated: "invalidated",
      GuildCreate: "guildCreate",
      GuildDelete: "guildDelete",
      VoiceStateUpdate: "voice",
    },
  };
});
vi.mock("@discordjs/voice", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    VoiceConnectionStatus: {
      Ready: "ready",
      Disconnected: "disconnected",
      Destroyed: "destroyed",
    },
    joinVoiceChannel: fixtures.join.mockImplementation(() => {
      const connection = Object.assign(new EventEmitter(), {
        state: { status: "ready" },
        subscribe: vi.fn(),
        destroy: vi.fn(function (this: { state: { status: string } }) {
          this.state.status = "destroyed";
        }),
      });
      fixtures.connection = connection;
      return connection;
    }),
    entersState: vi.fn(() => fixtures.joinWait ?? Promise.resolve()),
  };
});
import { DiscordEngine } from "../src/engine/discord";

const playback = { stop: vi.fn(), player: {} } as unknown as BroadcastPlayback;
const error = vi.fn();
const makeEngine = () => new DiscordEngine(playback, vi.fn(), error);
beforeEach(() => {
  fixtures.canSpeak = true;
  fixtures.joinWait = null;
  fixtures.join.mockClear();
  vi.mocked(playback.stop).mockClear();
  error.mockClear();
});
describe("intégration Discord simulée", () => {
  it("joins with DAVE enabled, no microphone capture and the audio player subscribed", async () => {
    const engine = makeEngine();
    await engine.connect("fake-test-token", "", false);
    expect(engine.state.status).toBe("online");
    const channels = await engine.channels("234567890123456789");
    expect(channels[0]?.accessible).toBe(true);
    await engine.join("234567890123456789", "345678901234567890");
    expect(fixtures.join).toHaveBeenCalledWith(
      expect.objectContaining({
        daveEncryption: true,
        selfDeaf: true,
        selfMute: false,
      }),
    );
    expect(engine.state.voice).toBe("ready");
    engine.leave();
    expect(engine.state.voice).toBe("idle");
    expect(playback.stop).toHaveBeenCalled();
    await engine.disconnect();
    expect(engine.state.status).toBe("offline");
  });
  it("redacts library errors rather than exposing their private contents", async () => {
    const engine = makeEngine();
    await expect(engine.connect("invalid", "", false)).rejects.toThrow(
      "Token du bot incorrect",
    );
    expect(JSON.stringify(engine.state)).not.toContain("private secret");
  });
  it("checks permissions before opening a voice connection", async () => {
    const engine = makeEngine();
    await engine.connect("test", "", false);
    fixtures.canSpeak = false;
    await expect(
      engine.join("234567890123456789", "345678901234567890"),
    ).rejects.toThrow("Permissions manquantes");
    expect(fixtures.join).not.toHaveBeenCalled();
    expect(engine.state.voice).toBe("idle");
  });
  it("cancels a pending join when leave is pressed", async () => {
    const engine = makeEngine();
    await engine.connect("test", "", false);
    let release!: () => void;
    fixtures.joinWait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const joining = engine.join("234567890123456789", "345678901234567890");
    const rejection = expect(joining).rejects.toThrow("annulée");
    await vi.waitFor(() => expect(fixtures.join).toHaveBeenCalled());
    engine.leave();
    release();
    await rejection;
    expect(engine.state.voice).toBe("idle");
  });
  it("stops playback on a dropped gateway connection", async () => {
    const engine = makeEngine();
    await engine.connect("test", "", false);
    await engine.join("234567890123456789", "345678901234567890");
    (fixtures.client as EventEmitter).emit("disconnect");
    expect(playback.stop).toHaveBeenCalled();
    expect(engine.state.voice).toBe("idle");
    expect(engine.state.status).toBe("reconnecting");
  });
  it("keeps only the newest of two simultaneous login requests", async () => {
    const engine = makeEngine();
    const first = engine.connect("old-test-token", "", false);
    const second = engine.connect("new-test-token", "", false);
    await expect(first).rejects.toThrow("annulée");
    await second;
    expect(engine.state.status).toBe("online");
    await engine.disconnect();
  });
});
