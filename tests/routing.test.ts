import { describe, expect, it } from "vitest";
import { defaultConfig, readConfig } from "../src/shared/model";
import { destinations, validateGameDevices } from "../src/shared/routing";

describe("séparation du vocal jeu et du bot Discord", () => {
  it("never sends virtual microphone sounds to the Discord bot and keeps preview local for every route", () => {
    expect(destinations("game")).toEqual({
      local: false,
      discord: false,
      game: true,
    });
    expect(destinations("micro")).toEqual({
      local: false,
      discord: false,
      game: true,
    });
    for (const output of ["local", "discord", "game", "micro"] as const)
      expect(destinations(output, true)).toEqual({
        local: true,
        discord: false,
        game: false,
      });
  });
  const devices = [
    {
      deviceId: "cable",
      kind: "audiooutput" as const,
      label: "CABLE Input (VB-Audio Virtual Cable)",
    },
    { deviceId: "headset", kind: "audiooutput" as const, label: "Casque USB" },
    { deviceId: "mic", kind: "audioinput" as const, label: "Microphone USB" },
    {
      deviceId: "loop",
      kind: "audioinput" as const,
      label: "CABLE Output (VB-Audio Virtual Cable)",
    },
  ];
  it("refuses defaults, disappeared outputs and physical speakers as the game destination", () => {
    for (const id of ["", "default", "communications", "missing", "headset"])
      expect(() =>
        validateGameDevices(
          { ...defaultConfig().settings, gameOutputId: id },
          devices,
        ),
      ).toThrow();
    expect(() =>
      validateGameDevices(
        { ...defaultConfig().settings, gameOutputId: "cable" },
        devices,
      ),
    ).not.toThrow();
  });
  it("requires an explicit real microphone and rejects a feedback loop", () => {
    for (const id of ["default", "", "missing", "loop"])
      expect(() =>
        validateGameDevices(
          {
            ...defaultConfig().settings,
            gameOutputId: "cable",
            gameMicEnabled: true,
            gameMicrophoneId: id,
          },
          devices,
        ),
      ).toThrow("vrai microphone");
    expect(() =>
      validateGameDevices(
        {
          ...defaultConfig().settings,
          gameOutputId: "cable",
          gameMicEnabled: true,
          gameMicrophoneId: "mic",
        },
        devices,
      ),
    ).not.toThrow();
  });
  it("blocks a virtual Windows default to avoid forwarding game and Discord output back into the game", () => {
    const all = [
      ...devices,
      {
        deviceId: "default",
        kind: "audiooutput" as const,
        label: "Default - CABLE Input (VB-Audio Virtual Cable)",
      },
    ];
    expect(() =>
      validateGameDevices(
        { ...defaultConfig().settings, gameOutputId: "cable" },
        all,
      ),
    ).toThrow("sortie Windows par défaut");
  });
  it("refuses sending the headphone monitor back to the virtual cable", () => {
    const settings = {
      ...defaultConfig().settings,
      gameOutputId: "cable",
      gameMonitorEnabled: true,
    };
    for (const id of ["", "default", "cable", "missing"])
      expect(() =>
        validateGameDevices({ ...settings, gameMonitorId: id }, devices),
      ).toThrow("casque");
    expect(() =>
      validateGameDevices({ ...settings, gameMonitorId: "headset" }, devices),
    ).not.toThrow();
  });
  it("migrates old libraries without enabling microphone capture or changing Discord selection", () => {
    const previous = defaultConfig();
    const old = {
      ...previous,
      version: 1,
      settings: Object.fromEntries(
        Object.entries(previous.settings).filter(
          ([key]) => !key.startsWith("game"),
        ),
      ),
    };
    old.settings.output = "discord";
    const migrated = readConfig(old);
    expect(migrated.version).toBe(3);
    expect(migrated.profiles).toEqual(old.profiles);
    expect(migrated.settings.output).toBe("discord");
    expect(migrated.settings.gameMicEnabled).toBe(false);
    expect(migrated.settings.gameOutputId).toBe("");
  });
  it.each(["local", "discord", "game"] as const)("preserves the previous %s destination during migration", (output) => {
    const config = defaultConfig();
    config.settings.output = output;
    const migrated = readConfig({ ...config, version: 2 });
    expect(migrated.settings).toEqual(config.settings);
    expect(migrated.version).toBe(3);
  });
});
