import { Worker } from "node:worker_threads";
import type { EngineCommand, EngineMessage } from "../shared/engine-protocol";
import { UserError } from "../shared/errors";

export class EngineBridge {
  private worker: Worker;
  private sequence = 0;
  private stopped = false;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(
    path: string,
    ffmpeg: string,
    private emit: (event: Exclude<EngineMessage, { type: "result" }>) => void,
  ) {
    this.worker = new Worker(path, {
      workerData: { ffmpeg },
      stdout: true,
      stderr: true,
    });
    // Never copy raw library output, request data or credentials to logs.
    this.worker.stdout?.resume();
    this.worker.stderr?.resume();
    this.worker.on("message", (message: EngineMessage) => {
      if (message.type !== "result") {
        this.emit(message);
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.ok) pending.resolve(message.value);
      else pending.reject(new UserError(message.error));
    });
    this.worker.on("error", () => this.fail());
    this.worker.on("exit", () => this.fail());
  }
  private fail(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(
        new UserError(
          "Le moteur Discord s’est arrêté. Redémarrez l’application.",
        ),
      );
    }
    this.pending.clear();
    this.emit({
      type: "error",
      message: "Le moteur Discord s’est arrêté. Redémarrez l’application.",
    });
  }
  request<T = void>(command: EngineCommand): Promise<T> {
    if (this.stopped)
      return Promise.reject(
        new UserError(
          "Le moteur Discord est indisponible. Redémarrez l’application.",
        ),
      );
    const id = ++this.sequence;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new UserError(
            "Discord ne répond pas. Déconnectez puis reconnectez le bot.",
          ),
        );
      }, 40_000);
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      this.worker.postMessage({ id, command });
    });
  }
  async dispose(): Promise<void> {
    if (!this.stopped) {
      await Promise.race([
        this.request({ type: "shutdown" }),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]).catch(() => {});
    }
    this.stopped = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new UserError("Fermeture en cours."));
    }
    this.pending.clear();
    await this.worker.terminate();
  }
}
