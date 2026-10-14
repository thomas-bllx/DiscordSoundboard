import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { normalizeShortcut, validateShortcuts } from "../src/shared/shortcuts";
import { defaultConfig } from "../src/shared/model";
import { ShortcutManager } from "../src/main/shortcuts";
import { sound } from "./helpers";

describe("raccourcis", () => {
  it("normalizes aliases, whitespace and modifier order", () => {
    expect(normalizeShortcut("alt + Ctrl + 1")).toBe("Control+Alt+1");
    expect(normalizeShortcut("SHIFT+CommandOrControl+A")).toBe(
      "Control+Shift+A",
    );
    expect(normalizeShortcut("")).toBe("");
  });
  it.each([
    "Win+R",
    "Alt+F4",
    "Control+Alt+Delete",
    "Control+Shift+Escape",
    "Control+Alt+F12",
    "A",
    "Control+A",
    "Ctrl+Control+A",
  ])("rejects reserved or ambiguous binding %s", (shortcut) => {
    expect(() => normalizeShortcut(shortcut)).toThrow();
  });
  it("detects normalized collisions including STOP", () => {
    const config = defaultConfig();
    config.sounds = [sound({ shortcut: "Alt+Ctrl+0" })];
    expect(() => validateShortcuts(config)).toThrow("déjà utilisé");
    config.sounds = [
      sound({ shortcut: "Ctrl+Alt+1" }),
      sound({ shortcut: "Alt+Control+1" }),
    ];
    expect(() => validateShortcuts(config)).toThrow("déjà utilisé");
  });
  it("allows reuse in separate profiles, registering only the active profile", () => {
    const config = defaultConfig();
    const otherId = randomUUID();
    config.profiles.push({ id: otherId, name: "Autre" });
    config.sounds = [
      sound({ shortcut: "Control+Alt+1" }),
      sound({ profileId: otherId, shortcut: "Control+Alt+1" }),
    ];
    validateShortcuts(config);
    const api = { register: vi.fn(() => true), unregisterAll: vi.fn() };
    const manager = new ShortcutManager(api, vi.fn(), vi.fn());
    expect(manager.restore(config)).toHaveLength(2);
    expect(api.register).toHaveBeenCalledTimes(2);
  });
  it("reports OS conflicts and restores after temporary disabling", () => {
    const config = defaultConfig();
    config.sounds.push(sound({ shortcut: "Control+Alt+1" }));
    const api = { register: vi.fn(() => false), unregisterAll: vi.fn() };
    const manager = new ShortcutManager(api, vi.fn(), vi.fn());
    expect(manager.restore(config).every((s) => s.status === "error")).toBe(
      true,
    );
    config.settings.shortcutsEnabled = false;
    expect(manager.restore(config).every((s) => s.status === "disabled")).toBe(
      true,
    );
    expect(api.register).toHaveBeenCalledTimes(2);
    api.register.mockReturnValue(true);
    config.settings.shortcutsEnabled = true;
    expect(
      manager.restore(config).every((s) => s.status === "registered"),
    ).toBe(true);
    manager.dispose();
    expect(api.unregisterAll).toHaveBeenCalledTimes(4);
  });
  it("dispatches a real registered callback to the matching action", () => {
    const config = defaultConfig();
    const entry = sound({ shortcut: "Control+Alt+1" });
    config.sounds.push(entry);
    const callbacks: (() => void)[] = [];
    const play = vi.fn(),
      stop = vi.fn();
    const manager = new ShortcutManager(
      {
        register: (_key, fn) => {
          callbacks.push(fn);
          return true;
        },
        unregisterAll: vi.fn(),
      },
      play,
      stop,
    );
    manager.restore(config);
    callbacks[0]!();
    callbacks[1]!();
    expect(stop).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledWith(entry.id);
  });
});
