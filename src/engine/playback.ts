import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  type AudioResource,
} from "@discordjs/voice";
import { idlePlayback, type PlaybackState } from "../shared/model";
import { UserError } from "../shared/errors";
import { demuxer } from "../main/audio-library";

export interface PlayRequest {
  soundId: string;
  name: string;
  path: string;
  volume: number;
  interrupt: boolean;
}
export class BroadcastPlayback {
  readonly player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Stop },
  });
  state: PlaybackState = idlePlayback();
  private process: ChildProcessWithoutNullStreams | null = null;
  private resource: AudioResource<{ requestId: number }> | null = null;
  private sequence = 0;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private ffmpeg: string,
    private changed: (state: PlaybackState) => void,
    private error: (message: string) => void,
  ) {
    this.player.on("stateChange", (old, current) => {
      if (
        current.status === AudioPlayerStatus.Playing &&
        (current.resource.metadata as { requestId?: number } | null)
          ?.requestId === this.state.requestId
      ) {
        if (this.loadTimer) clearTimeout(this.loadTimer);
        this.loadTimer = null;
        this.state = {
          ...this.state,
          status: "playing",
          startedAt: Date.now(),
        };
        this.changed(this.state);
      }
      if (
        current.status === AudioPlayerStatus.Idle &&
        "resource" in old &&
        (old.resource.metadata as { requestId?: number } | null)?.requestId ===
          this.state.requestId
      )
        this.finish();
    });
    this.player.on("error", (error) => {
      if (
        (error.resource.metadata as { requestId?: number } | null)
          ?.requestId !== this.state.requestId
      )
        return;
      this.stop();
      this.error(
        "Lecture interrompue : le fichier ne peut pas être décodé ou la connexion vocale est perdue.",
      );
    });
  }
  play(request: PlayRequest, ready: boolean): void {
    if (!ready)
      throw new UserError("Rejoignez d’abord un salon vocal avec le bot.");
    if (!request.interrupt && this.state.status !== "idle")
      throw new UserError(
        "Un son est déjà diffusé. Arrêtez-le ou activez le remplacement de la lecture.",
      );
    this.stop();
    const requestId = ++this.sequence;
    this.state = {
      status: "loading",
      soundId: request.soundId,
      name: request.name,
      requestId,
      startedAt: null,
    };
    this.changed(this.state);
    const child = spawn(
      this.ffmpeg,
      [
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-f",
        demuxer(request.path),
        "-i",
        request.path,
        "-map",
        "0:a:0",
        "-vn",
        "-sn",
        "-dn",
        "-ac",
        "2",
        "-ar",
        "48000",
        "-f",
        "s16le",
        "pipe:1",
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    this.process = child;
    child.stdin.end();
    child.stderr.resume(); // Never log decoder output containing user paths.
    const fail = () => {
      if (this.state.requestId !== requestId || this.state.status === "idle")
        return;
      this.stop();
      this.error(
        "Décodage audio impossible. Vérifiez le fichier ou réimportez-le.",
      );
    };
    child.once("error", fail);
    child.once("close", (code) => {
      if (code !== 0 && code !== null) fail();
    });
    try {
      this.resource = createAudioResource(child.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true,
        metadata: { requestId },
      });
      this.resource.volume?.setVolume(request.volume);
      this.player.play(this.resource);
      this.loadTimer = setTimeout(fail, 20_000);
    } catch {
      fail();
    }
  }
  setVolume(volume: number): void {
    this.resource?.volume?.setVolume(volume);
  }
  private finish(): void {
    if (this.loadTimer) clearTimeout(this.loadTimer);
    this.loadTimer = null;
    const process = this.process;
    this.process = null;
    this.resource = null;
    this.state = idlePlayback(++this.sequence);
    process?.stdout.destroy();
    process?.kill();
    this.changed(this.state);
  }
  stop(): void {
    // Invalidate callbacks before stop() emits synchronous player events.
    this.finish();
    this.player.stop(true);
  }
}
