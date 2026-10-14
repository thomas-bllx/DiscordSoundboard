import type { Settings } from "./model";

export function destinations(output: Settings["output"], preview = false) {
  return {
    local: preview || output === "local",
    discord: !preview && (output === "discord" || output === "both"),
    game: !preview && (output === "game" || output === "both"),
  };
}

export const isExplicitDevice = (id: string) =>
  !!id && id !== "default" && id !== "communications";
export const isCableInput = (label: string) =>
  /\bCABLE Input\b/i.test(label) && /VB-Audio/i.test(label);
export const isVirtualDevice = (label: string) =>
  /VB-Audio|CABLE (Input|Output)|Voicemeeter|Stereo Mix|Mixage st.r.o/i.test(
    label,
  );

export function validateGameDevices(
  settings: Settings,
  devices: Pick<MediaDeviceInfo, "deviceId" | "kind" | "label">[],
): void {
  const defaultOutput = devices.find(
    (d) => d.kind === "audiooutput" && d.deviceId === "default",
  );
  if (defaultOutput && isCableInput(defaultOutput.label))
    throw new Error(
      "CABLE Input est la sortie Windows par défaut. Choisissez votre casque dans les paramètres audio Windows pour éviter d’envoyer tous les sons du PC dans le jeu.",
    );
  const output = devices.find(
    (d) => d.kind === "audiooutput" && d.deviceId === settings.gameOutputId,
  );
  if (
    !isExplicitDevice(settings.gameOutputId) ||
    !output ||
    !isCableInput(output.label)
  )
    throw new Error(
      "Le périphérique VB-CABLE est absent. Actualisez les appareils ou installez le composant audio.",
    );
  if (settings.gameMicEnabled) {
    const mic = devices.find(
      (d) =>
        d.kind === "audioinput" && d.deviceId === settings.gameMicrophoneId,
    );
    if (
      !isExplicitDevice(settings.gameMicrophoneId) ||
      !mic ||
      isVirtualDevice(mic.label)
    )
      throw new Error(
        "Sélectionnez votre vrai microphone dans les réglages En jeu.",
      );
  }
  if (settings.gameMonitorEnabled) {
    const monitor = devices.find(
      (d) => d.kind === "audiooutput" && d.deviceId === settings.gameMonitorId,
    );
    if (
      !isExplicitDevice(settings.gameMonitorId) ||
      !monitor ||
      isVirtualDevice(monitor.label)
    )
      throw new Error(
        "Sélectionnez votre casque pour le retour des sons. Une sortie virtuelle ne convient pas.",
      );
  }
}
