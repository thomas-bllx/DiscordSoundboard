import type { DesktopApi } from "../shared/model";
declare global {
  interface AudioContext {
    readonly sinkId: string | { type: "none" };
    setSinkId(id: string | { type: "none" }): Promise<void>;
  }
  interface Window {
    soundboard: DesktopApi;
  }
}
export {};
