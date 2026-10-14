import type { Config, ShortcutStatus } from "../shared/model";
import { normalizeShortcut } from "../shared/shortcuts";

export interface ShortcutApi {
  register(accelerator: string, callback: () => void): boolean;
  unregisterAll(): void;
}
export class ShortcutManager {
  constructor(
    private api: ShortcutApi,
    private play: (id: string) => void,
    private stop: () => void,
  ) {}
  restore(config: Config, suspended = false): ShortcutStatus[] {
    this.api.unregisterAll();
    const bindings = [
      { soundId: "stop", shortcut: config.settings.stopShortcut },
      ...config.sounds
        .filter((s) => s.profileId === config.activeProfileId)
        .map((s) => ({ soundId: s.id, shortcut: s.shortcut })),
    ].filter((s) => s.shortcut);
    const used = new Set<string>();
    return bindings.map((binding) => {
      const result: ShortcutStatus = { ...binding, status: "disabled" };
      if (!config.settings.shortcutsEnabled || suspended) return result;
      try {
        const accelerator = normalizeShortcut(binding.shortcut);
        if (used.has(accelerator)) throw new Error("duplicate");
        used.add(accelerator);
        const ok = this.api.register(accelerator, () =>
          binding.soundId === "stop" ? this.stop() : this.play(binding.soundId),
        );
        result.status = ok ? "registered" : "error";
        if (!ok)
          result.error =
            "Raccourci occupé par une autre application ou refusé par Windows.";
      } catch {
        result.status = "error";
        result.error = "Raccourci invalide, réservé ou en doublon.";
      }
      return result;
    });
  }
  dispose(): void {
    this.api.unregisterAll();
  }
}
