import type { ChannelInfo, DiscordState, PlaybackState } from "./model";

export type EngineCommand =
  | { type: "connect"; token: string; userId: string; followUser: boolean }
  | { type: "disconnect" }
  | { type: "channels"; guildId: string }
  | { type: "join"; guildId: string; channelId: string }
  | { type: "leave" }
  | {
      type: "play";
      soundId: string;
      name: string;
      path: string;
      volume: number;
      interrupt: boolean;
    }
  | { type: "stop" }
  | { type: "volume"; volume: number }
  | { type: "follow"; userId: string; enabled: boolean }
  | { type: "shutdown" };
export interface EngineRequest {
  id: number;
  command: EngineCommand;
}
export type EngineMessage =
  | { type: "result"; id: number; ok: true; value: void | ChannelInfo[] }
  | { type: "result"; id: number; ok: false; error: string }
  | { type: "discord"; state: DiscordState }
  | { type: "playback"; state: PlaybackState }
  | { type: "error"; message: string };
