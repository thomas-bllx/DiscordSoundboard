import { parentPort, workerData } from "node:worker_threads";
import { BroadcastPlayback } from "./playback";
import { DiscordEngine } from "./discord";
import type { EngineMessage, EngineRequest } from "../shared/engine-protocol";
import { publicError } from "../shared/errors";

if (!parentPort) throw new Error("Missing parent port");
const send = (message: EngineMessage) => parentPort!.postMessage(message);
const error = (message: string) => send({ type: "error", message });
const playback = new BroadcastPlayback(
  (workerData as { ffmpeg: string }).ffmpeg,
  (state) => send({ type: "playback", state }),
  error,
);
const discord = new DiscordEngine(
  playback,
  (state) => send({ type: "discord", state }),
  error,
);
parentPort.on("message", async ({ id, command }: EngineRequest) => {
  try {
    let value;
    switch (command.type) {
      case "connect":
        await discord.connect(
          command.token,
          command.userId,
          command.followUser,
        );
        break;
      case "disconnect":
        await discord.disconnect();
        break;
      case "channels":
        value = await discord.channels(command.guildId);
        break;
      case "join":
        await discord.join(command.guildId, command.channelId);
        break;
      case "leave":
        discord.leave();
        break;
      case "play":
        playback.play(command, discord.state.voice === "ready");
        break;
      case "stop":
        playback.stop();
        break;
      case "volume":
        playback.setVolume(command.volume);
        break;
      case "follow":
        await discord.setFollow(command.userId, command.enabled);
        break;
      case "shutdown":
        await discord.disconnect();
        break;
    }
    send({ type: "result", id, ok: true, value });
  } catch (exception) {
    send({ type: "result", id, ok: false, error: publicError(exception) });
  }
});
process.on("unhandledRejection", () =>
  error(
    "Le moteur Discord a rencontré une erreur. Déconnectez puis reconnectez le bot.",
  ),
);
