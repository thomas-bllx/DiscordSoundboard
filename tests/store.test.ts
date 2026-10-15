import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigStore, TokenVault } from "../src/main/store";
import { ConfigSchema, defaultConfig } from "../src/shared/model";
import { sound } from "./helpers";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "soundboard-store-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
describe("configuration locale", () => {
  it("persists sounds and settings across a restart", async () => {
    const store = new ConfigStore(root);
    await store.load();
    const entry = sound();
    await store.change((c) => {
      c.sounds.push(entry);
      c.settings.masterVolume = 0.3;
    });
    const next = new ConfigStore(root);
    await next.load();
    expect(next.value.sounds).toEqual([entry]);
    expect(next.value.settings.masterVolume).toBe(0.3);
  });
  it("serializes concurrent writes without losing settings", async () => {
    const store = new ConfigStore(root);
    await store.load();
    await Promise.all([
      store.change((c) => {
        c.settings.masterVolume = 0.2;
      }),
      store.change((c) => {
        c.settings.interrupt = false;
      }),
    ]);
    expect(store.value.settings).toMatchObject({
      masterVolume: 0.2,
      interrupt: false,
    });
    expect(
      ConfigSchema.parse(JSON.parse(await readFile(store.file, "utf8"))),
    ).toEqual(store.value);
  });
  it("migrates the removed dual route without turning on the microphone and keeps an exact backup", async () => {
    const entry = sound();
    const legacy = {
      ...defaultConfig(), version: 2, sounds: [entry],
      settings: { ...defaultConfig().settings, output: "both", gameOutputId: "saved-cable", gameMicEnabled: false },
    };
    const contents = JSON.stringify(legacy);
    await writeFile(join(root, "config.json"), contents);
    const store = new ConfigStore(root);
    await store.load();
    expect(store.value.version).toBe(3);
    expect(store.value.sounds).toEqual([entry]);
    expect(store.value.settings).toMatchObject({ output: "game", gameOutputId: "saved-cable", gameMicEnabled: false });
    expect(store.warning).toContain("Micro partout");
    const backups = (await readdir(root)).filter((name) => name.startsWith("config.json.v2-"));
    expect(backups).toHaveLength(1);
    expect(await readFile(join(root, backups[0]!), "utf8")).toBe(contents);
    expect(JSON.parse(await readFile(store.file, "utf8"))).toEqual(store.value);
  });
  it("persists the universal microphone mode and rejects the removed dual route", async () => {
    const store = new ConfigStore(root);
    await store.load();
    await store.change((config) => {
      config.settings.output = "micro";
      config.settings.gameMicEnabled = true;
      config.settings.gameMicrophoneId = "saved-microphone";
    });
    const restarted = new ConfigStore(root);
    await restarted.load();
    expect(restarted.value.settings).toMatchObject({ output: "micro", gameMicEnabled: true, gameMicrophoneId: "saved-microphone" });
    expect(ConfigSchema.safeParse({ ...store.value, settings: { ...store.value.settings, output: "both" } }).success).toBe(false);
  });
  it("recovers the last valid backup and preserves damaged data", async () => {
    const store = new ConfigStore(root);
    await store.load();
    await store.change((c) => {
      c.sounds.push(sound());
    });
    await store.change((c) => {
      c.settings.masterVolume = 0.2;
    });
    await writeFile(store.file, "broken");
    const next = new ConfigStore(root);
    await next.load();
    expect(next.value.sounds).toHaveLength(1);
    expect(next.warning).toContain("sauvegarde");
  });
  it("does not overwrite a future config version", async () => {
    const config = JSON.stringify({ ...defaultConfig(), version: 99 });
    await writeFile(join(root, "config.json"), config);
    await expect(new ConfigStore(root).load()).rejects.toThrow("autre version");
    expect(await readFile(join(root, "config.json"), "utf8")).toBe(config);
  });
  it("rejects bad paths, out-of-range volume and unknown secret fields", () => {
    const config = defaultConfig();
    config.sounds.push(sound({ file: "../../secret.wav" }));
    expect(ConfigSchema.safeParse(config).success).toBe(false);
    expect(
      ConfigSchema.safeParse({ ...defaultConfig(), token: "never-here" })
        .success,
    ).toBe(false);
    config.sounds = [sound({ volume: 99 })];
    expect(ConfigSchema.safeParse(config).success).toBe(false);
  });
  it("a rejected change leaves the previous config intact and future changes possible", async () => {
    const store = new ConfigStore(root);
    await store.load();
    await expect(
      store.change((c) => {
        c.settings.masterVolume = 2;
      }),
    ).rejects.toThrow();
    expect(store.value.settings.masterVolume).toBe(0.7);
    await store.change((c) => {
      c.settings.masterVolume = 0.1;
    });
    expect(store.value.settings.masterVolume).toBe(0.1);
  });
});
describe("coffre des secrets", () => {
  it("never writes a token if secure storage is unavailable", async () => {
    const file = join(root, "token.bin");
    const vault = new TokenVault(file, {
      available: () => false,
      encrypt: () => Buffer.from("bad"),
      decrypt: () => "bad",
    });
    await expect(vault.save("secret-token")).rejects.toThrow("indisponible");
    expect(await vault.present()).toBe(false);
  });
  it("stores only the encrypted bytes, reads through the provider and deletes", async () => {
    const file = join(root, "token.bin");
    const vault = new TokenVault(file, {
      available: () => true,
      encrypt: () => Buffer.from([0, 1, 255, 24]),
      decrypt: () => "secret-token",
    });
    await vault.save("secret-token");
    expect((await readFile(file)).includes("secret-token")).toBe(false);
    expect(await vault.read()).toBe("secret-token");
    await vault.remove();
    expect(await vault.present()).toBe(false);
    await expect(vault.read()).rejects.toThrow("Token absent");
  });
});
