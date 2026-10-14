import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { ConfigStore } from "../src/main/store";
import { AudioLibrary, probeAudio } from "../src/main/audio-library";
import { wav } from "./helpers";
import { DAVESession, DAVE_PROTOCOL_VERSION } from "@snazzah/davey";
import { BroadcastPlayback } from "../src/engine/playback";
import { spawn } from "node:child_process";
import { createAudioResource, StreamType } from "@discordjs/voice";

let root: string;
const ffmpeg = resolve("vendor/ffmpeg/ffmpeg.exe");
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "soundboard-audio-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
describe("chaîne audio réelle", () => {
  it.each([
    ["mp3", "mp3", 5],
    ["vorbis", "ogg", 5],
    ["opus", "ogg", 0.5],
  ] as const)("decodes the synthetic %s fixture with the bundled runtime", async (codec, extension, seconds) => {
    const fixtures = JSON.parse(await readFile(new URL("./audio-fixtures.json", import.meta.url), "utf8"));
    const source = join(root, `fixture.${extension}`);
    await writeFile(source, Buffer.from(fixtures[codec], "base64"));
    expect(await probeAudio(ffmpeg, source)).toBeCloseTo(seconds, 1);
  });

  it("decodes a real WAV with the embedded FFmpeg and copies it persistently", async () => {
    const store = new ConfigStore(join(root, "data"));
    await store.load();
    const source = join(root, "source.wav");
    await writeFile(source, wav(1));
    expect(await probeAudio(ffmpeg!, source)).toBeCloseTo(1, 1);
    const library = new AudioLibrary(store, ffmpeg!, vi.fn());
    const report = await library.import([source]);
    expect(report).toEqual({ imported: 1, failures: [] });
    await rm(source);
    expect(
      (await readFile(library.path(store.value.sounds[0]!))).length,
    ).toBeGreaterThan(44);
  });
  it("rejects corrupt audio and non-audio files without adding broken entries", async () => {
    const store = new ConfigStore(join(root, "data"));
    await store.load();
    const source = join(root, "broken.wav");
    await writeFile(source, "bad data");
    const library = new AudioLibrary(store, ffmpeg!, vi.fn());
    const report = await library.import([source, join(root, "secret.txt")]);
    expect(report.imported).toBe(0);
    expect(report.failures).toHaveLength(2);
    expect(store.value.sounds).toHaveLength(0);
    expect(await readdir(join(store.root, "library"))).toHaveLength(0);
  });
  it("loads the native DAVE library and generates a real key package", () => {
    expect(DAVE_PROTOCOL_VERSION).toBeGreaterThanOrEqual(1);
    const session = new DAVESession(
      DAVE_PROTOCOL_VERSION,
      "123456789012345678",
      "234567890123456789",
    );
    expect(session.getSerializedKeyPackage().length).toBeGreaterThan(0);
    session.reset();
  });
  it("runs FFmpeg + PCM volume + Opus encoding, replaces and stops resources", async () => {
    const source = join(root, "test.wav");
    await writeFile(source, wav(3));
    const error = vi.fn();
    const player = new BroadcastPlayback(ffmpeg!, vi.fn(), error);
    try {
      player.play(
        {
          soundId: "first",
          name: "Premier",
          path: source,
          volume: 0.25,
          interrupt: true,
        },
        true,
      );
      await vi.waitFor(
        () => expect(player.player.state.status).not.toBe("buffering"),
        { timeout: 6000 },
      );
      // No voice subscriber: the resource still really encodes, while the player is paused/idle.
      player.play(
        {
          soundId: "second",
          name: "Deuxième",
          path: source,
          volume: 0.3,
          interrupt: true,
        },
        true,
      );
      expect(player.state.soundId).toBe("second");
      player.setVolume(0.7);
      player.stop();
      expect(player.state.status).toBe("idle");
      expect(error).not.toHaveBeenCalled();
    } finally {
      player.stop();
    }
  });
  it("refuses broadcast without a ready voice connection", () => {
    const player = new BroadcastPlayback(ffmpeg!, vi.fn(), vi.fn());
    expect(() =>
      player.play(
        {
          soundId: "s",
          name: "Test",
          path: "x.wav",
          volume: 1,
          interrupt: true,
        },
        false,
      ),
    ).toThrow("salon vocal");
    player.stop();
  });
  it("produces actual Opus packets from PCM using the packaged encoder", async () => {
    const source = join(root, "opus.wav");
    await writeFile(source, wav(0.2));
    const child = spawn(
      ffmpeg,
      [
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        source,
        "-ac",
        "2",
        "-ar",
        "48000",
        "-f",
        "s16le",
        "pipe:1",
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] },
    );
    const resource = createAudioResource(child.stdout, {
      inputType: StreamType.Raw,
      inlineVolume: true,
    });
    resource.volume!.setVolume(0.5);
    const packets: Buffer[] = [];
    try {
      for await (const packet of resource.playStream)
        packets.push(Buffer.from(packet));
      expect(packets.length).toBeGreaterThanOrEqual(10);
      expect(packets.some((p) => p.length > 10)).toBe(true);
    } finally {
      resource.playStream.destroy();
      child.kill();
    }
  });
});
