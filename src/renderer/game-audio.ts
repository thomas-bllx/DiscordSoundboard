import type { DesktopApi, LocalAudioEvent, Settings } from "../shared/model";
import { validateGameDevices } from "../shared/routing";

// This graph sends only microphone + pads to one explicitly selected virtual output.
// The monitor receives pads only: never the microphone or game/Discord system audio.
export class GameAudio {
  private context: AudioContext | null = null;
  private microphone: MediaStream | null = null;
  private micGain: GainNode | null = null;
  private mix: DynamicsCompressorNode | null = null;
  private pads: GainNode | null = null;
  private monitor: HTMLAudioElement | null = null;
  private sound: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private settings: Settings | null = null;
  private generation = 0;
  private soundRequest = 0;
  private active = false;
  private deviceChange = () => {
    void this.checkDevices();
  };
  constructor(private api: DesktopApi) {
    navigator.mediaDevices.addEventListener("devicechange", this.deviceChange);
  }
  async devices(): Promise<MediaDeviceInfo[]> {
    const permission = await this.api.allowMicrophone(true);
    if (!permission.ok) throw new Error(permission.error);
    try {
      return await navigator.mediaDevices.enumerateDevices();
    } finally {
      if (!this.active) await this.api.allowMicrophone(false);
    }
  }
  async start(settings: Settings): Promise<void> {
    await this.stop();
    const generation = this.generation;
    this.settings = { ...settings };
    await this.api.setGameSession({ status: "starting", error: null });
    try {
      const permission = await this.api.allowMicrophone(true);
      if (!permission.ok) throw new Error(permission.error);
      const devices = await navigator.mediaDevices.enumerateDevices();
      validateGameDevices(settings, devices);
      if (generation !== this.generation) return;
      const context = new AudioContext({
        latencyHint: "interactive",
        sampleRate: 48000,
      });
      this.context = context;
      await context.setSinkId(settings.gameOutputId);
      if (generation !== this.generation) return;
      if (context.sinkId !== settings.gameOutputId)
        throw new Error("La sortie audio du jeu n’a pas pu être sélectionnée.");
      context.addEventListener("sinkchange", () => {
        if (this.active && context.sinkId !== this.settings?.gameOutputId)
          void this.fail(
            "La sortie du jeu a changé. Diffusion arrêtée pour conserver la séparation avec Discord.",
          );
      });
      context.addEventListener("error", () => {
        void this.fail(
          "Le périphérique audio ne répond plus. Réactivez le mode jeu.",
        );
      });
      this.mix = context.createDynamicsCompressor();
      this.mix.threshold.value = -3;
      this.mix.knee.value = 0;
      this.mix.ratio.value = 20;
      this.mix.attack.value = 0.003;
      this.mix.release.value = 0.1;
      this.mix.connect(context.destination);
      this.pads = context.createGain();
      this.pads.connect(this.mix);
      this.micGain = context.createGain();
      this.micGain.gain.value = settings.gameMicVolume;
      this.micGain.connect(this.mix);
      if (settings.gameMicEnabled) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: settings.gameMicrophoneId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
        if (generation !== this.generation) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        this.microphone = stream;
        stream.getAudioTracks().forEach((track) =>
          track.addEventListener("ended", () => {
            if (this.active)
              void this.fail(
                "Microphone débranché. Réactivez le mode jeu après reconnexion.",
              );
          }),
        );
        context.createMediaStreamSource(stream).connect(this.micGain);
      }
      if (settings.gameMonitorEnabled) {
        const destination = context.createMediaStreamDestination();
        this.pads.connect(destination);
        const monitor = new Audio();
        this.monitor = monitor;
        monitor.srcObject = destination.stream;
        monitor.volume = settings.gameMonitorVolume;
        await monitor.setSinkId(settings.gameMonitorId);
        if (generation !== this.generation) return;
        await monitor.play();
      }
      await context.resume();
      if (generation !== this.generation) return;
      this.active = true;
      const result = await this.api.setGameSession({
        status: "ready",
        error: null,
      });
      if (!result.ok) throw new Error(result.error);
    } catch (error) {
      if (generation !== this.generation) return;
      await this.fail(
        error instanceof Error
          ? error.message
          : "Impossible d’activer l’audio en jeu.",
      );
    }
  }
  update(settings: Settings): void {
    if (this.micGain) this.micGain.gain.value = settings.gameMicVolume;
    if (this.monitor) this.monitor.volume = settings.gameMonitorVolume;
  }
  receive(event: LocalAudioEvent): void {
    if (event.type === "volume") {
      if (this.sound) this.sound.volume = event.volume;
      return;
    }
    this.resetSound();
    this.soundRequest = event.requestId;
    if (event.type === "stop") return;
    void this.play(event);
  }
  private async play(
    event: Extract<LocalAudioEvent, { type: "play" }>,
  ): Promise<void> {
    const id = event.requestId;
    try {
      if (!this.active || !this.context || !this.pads || !this.settings)
        throw new Error("Le mode jeu est désactivé.");
      validateGameDevices(
        this.settings,
        await navigator.mediaDevices.enumerateDevices(),
      );
      if (this.soundRequest !== id || !this.context || !this.pads) return;
      const sound = new Audio();
      sound.crossOrigin = "anonymous";
      sound.src = `soundboard://audio/${event.sound.id}`;
      sound.volume = event.volume;
      this.sound = sound;
      this.source = this.context.createMediaElementSource(sound);
      this.source.connect(this.pads);
      const report = (status: "playing" | "ended" | "error") => {
        if (this.sound !== sound || this.soundRequest !== id) return;
        void this.api.reportGame(id, status);
        if (status !== "playing") this.resetSound();
      };
      sound.addEventListener("playing", () => report("playing"), {
        once: true,
      });
      sound.addEventListener("ended", () => report("ended"), { once: true });
      sound.addEventListener("error", () => report("error"), { once: true });
      await this.context.resume();
      if (this.soundRequest !== id) return;
      await sound.play();
    } catch (error) {
      if (this.soundRequest !== id) return;
      this.resetSound();
      await this.api.reportGame(id, "error");
      await this.fail(
        error instanceof Error ? error.message : "Lecture en jeu impossible.",
      );
    }
  }
  private async checkDevices(): Promise<void> {
    if (!this.active || !this.settings) return;
    const generation = this.generation;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (generation !== this.generation || !this.active) return;
      validateGameDevices(this.settings, devices);
    } catch {
      if (generation === this.generation)
        await this.fail(
          "Un périphérique audio a été débranché. Diffusion arrêtée, sans changer de sortie.",
        );
    }
  }
  private resetSound(): void {
    ++this.soundRequest;
    this.source?.disconnect();
    this.source = null;
    if (this.sound) {
      this.sound.pause();
      this.sound.removeAttribute("src");
      this.sound.load();
    }
    this.sound = null;
  }
  async stop(): Promise<void> {
    const generation = ++this.generation;
    this.active = false;
    this.resetSound();
    this.microphone?.getTracks().forEach((t) => t.stop());
    this.microphone = null;
    if (this.monitor) {
      this.monitor.pause();
      this.monitor.srcObject = null;
    }
    this.monitor = null;
    const context = this.context;
    this.context = null;
    this.micGain = null;
    this.mix = null;
    this.pads = null;
    if (context && context.state !== "closed")
      await context.close().catch(() => {});
    if (generation !== this.generation) return;
    await this.api.allowMicrophone(false);
    if (generation !== this.generation) return;
    await this.api.setGameSession({ status: "off", error: null });
  }
  private async fail(message: string): Promise<void> {
    await this.stop();
    await this.api.setGameSession({
      status: "error",
      error: message.slice(0, 500),
    });
  }
  dispose(): void {
    navigator.mediaDevices.removeEventListener(
      "devicechange",
      this.deviceChange,
    );
    void this.stop().catch(() => {});
  }
}
