import type { Config } from "./model";
import { UserError } from "./errors";

const modifierAliases: Record<string, string> = {
  ctrl: "Control",
  control: "Control",
  commandorcontrol: "Control",
  cmdorctrl: "Control",
  alt: "Alt",
  shift: "Shift",
};
const namedKeys = [
  "Space",
  "Enter",
  "Escape",
  "Up",
  "Down",
  "Left",
  "Right",
  "Insert",
  "Delete",
  "Home",
  "End",
  "PageUp",
  "PageDown",
];
export function normalizeShortcut(value: string): string {
  if (!value.trim()) return "";
  const parts = value.split("+").map((p) => p.trim().toLowerCase());
  const last = parts.pop()!;
  const mods = parts.map((p) => modifierAliases[p]);
  if (mods.some((p) => !p) || new Set(mods).size !== mods.length) {
    throw new UserError(
      "Utilisez Ctrl, Alt et/ou Maj, puis une touche. La touche Windows est réservée.",
    );
  }
  let key =
    /^[a-z0-9]$/.test(last) || /^f([1-9]|1[0-9]|2[0-4])$/.test(last)
      ? last.toUpperCase()
      : "";
  key ||= namedKeys.find((k) => k.toLowerCase() === last) ?? "";
  if (!key)
    throw new UserError("Touche non reconnue. Exemple : Control+Alt+1.");
  if (
    key === "F12" ||
    (mods.length < 2 && !/^F\d+$/.test(key)) ||
    (mods.includes("Alt") && key === "F4") ||
    (mods.includes("Control") && mods.includes("Alt") && key === "Delete") ||
    (mods.includes("Control") && key === "Escape")
  ) {
    throw new UserError(
      "Ce raccourci est réservé ou trop facile à déclencher. Essayez Ctrl+Alt+une touche.",
    );
  }
  return [
    ...["Control", "Alt", "Shift"].filter((m) => mods.includes(m)),
    key,
  ].join("+");
}

export function validateShortcuts(config: Config): void {
  const stop = normalizeShortcut(config.settings.stopShortcut);
  for (const profile of config.profiles) {
    const used = new Set(stop ? [stop] : []);
    for (const sound of config.sounds.filter(
      (s) => s.profileId === profile.id,
    )) {
      const shortcut = normalizeShortcut(sound.shortcut);
      if (!shortcut) continue;
      if (used.has(shortcut))
        throw new UserError(
          `Raccourci déjà utilisé dans « ${profile.name} » : ${shortcut}.`,
        );
      used.add(shortcut);
    }
  }
}
