import type { LocalAudioEvent, DesktopApi } from "../shared/model";
import { isExplicitDevice, isVirtualDevice } from "../shared/routing";

export class PreviewPlayer {
  private audio: HTMLAudioElement | null = null;
  private generation = 0;
  private headsetId = "";
  private requireHeadset = false;
  constructor(private api: DesktopApi) {}
  configure(headsetId: string, requireHeadset: boolean): void {
    this.headsetId = headsetId;
    this.requireHeadset = requireHeadset;
  }
  receive(event: LocalAudioEvent): void {
    if (event.type === "volume") {
      if (this.audio) this.audio.volume = event.volume;
      return;
    }
    this.reset();
    this.generation = event.requestId;
    if (event.type === "stop") return;
    const audio = new Audio(`soundboard://audio/${event.sound.id}`);
    this.audio = audio;
    audio.volume = event.volume;
    const report = (status: "playing" | "ended" | "error") => {
      if (this.generation !== event.requestId || this.audio !== audio) return;
      void this.api.reportLocal(event.requestId, status);
      if (status !== "playing") this.reset();
    };
    audio.addEventListener("playing", () => report("playing"), { once: true });
    audio.addEventListener("ended", () => report("ended"), { once: true });
    audio.addEventListener("error", () => report("error"), { once: true });
    void (async () => {
      if (isExplicitDevice(this.headsetId)) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const device = devices.find(
          (d) => d.kind === "audiooutput" && d.deviceId === this.headsetId,
        );
        if (!device || isVirtualDevice(device.label))
          throw new Error("Casque indisponible");
        await audio.setSinkId(this.headsetId);
      } else if (this.requireHeadset)
        throw new Error("Choisissez votre casque dans En jeu");
      if (this.audio === audio && this.generation === event.requestId)
        await audio.play();
    })().catch(() => report("error"));
  }
  reset(): void {
    const old = this.audio;
    this.audio = null;
    ++this.generation;
    if (old) {
      old.pause();
      old.removeAttribute("src");
      old.load();
    }
  }
}
