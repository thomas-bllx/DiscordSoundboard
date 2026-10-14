import {
  idlePlayback,
  type LocalAudioEvent,
  type PlaybackState,
  type Sound,
} from "../shared/model";
import { UserError } from "../shared/errors";

export class LocalPlayback {
  state: PlaybackState = idlePlayback();
  private sequence = 0;
  constructor(
    private emit: (event: LocalAudioEvent) => void,
    private changed: () => void,
  ) {}
  play(sound: Sound, volume: number, interrupt: boolean): void {
    if (!interrupt && this.state.status !== "idle")
      throw new UserError(
        "Un son est déjà en cours. Arrêtez-le ou activez le remplacement de la lecture.",
      );
    this.state = {
      status: "loading",
      requestId: ++this.sequence,
      soundId: sound.id,
      name: sound.name,
      startedAt: null,
    };
    this.emit({ type: "play", sound, volume, requestId: this.sequence });
    this.changed();
  }
  report(requestId: number, status: "playing" | "ended" | "error"): boolean {
    if (requestId !== this.state.requestId || this.state.status === "idle")
      return false;
    this.state =
      status === "playing"
        ? { ...this.state, status, startedAt: Date.now() }
        : idlePlayback(requestId);
    this.changed();
    return status === "error";
  }
  setVolume(volume: number): void {
    this.emit({ type: "volume", volume });
  }
  stop(): void {
    this.state = idlePlayback(++this.sequence);
    this.emit({ type: "stop", requestId: this.sequence });
    this.changed();
  }
}
