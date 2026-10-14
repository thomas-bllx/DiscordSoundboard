import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { AppEvent, DesktopApi, Result } from "../shared/model";

function invoke<T>(action: string, data?: unknown): Promise<Result<T>> {
  return ipcRenderer.invoke("soundboard:invoke", { action, data }) as Promise<
    Result<T>
  >;
}
const api: DesktopApi = {
  getState: () => invoke("state"),
  importSounds: (paths) => invoke("import", paths),
  pathsForFiles: (files) =>
    files.map((file) => webUtils.getPathForFile(file)).filter(Boolean),
  updateSound: (id, patch) => invoke("sound:update", { id, patch }),
  deleteSound: (id) => invoke("sound:delete", id),
  reorderSounds: (ids) => invoke("sound:reorder", ids),
  createProfile: (name) => invoke("profile:create", name),
  renameProfile: (id, name) => invoke("profile:rename", { id, name }),
  deleteProfile: (id) => invoke("profile:delete", id),
  selectProfile: (id) => invoke("profile:select", id),
  updateSettings: (patch) => invoke("settings", patch),
  play: (id, preview = false) => invoke("play", { id, preview }),
  stop: () => invoke("stop"),
  reportLocal: (requestId, status) =>
    invoke("local:status", { requestId, status }),
  reportGame: (requestId, status) =>
    invoke("game:status", { requestId, status }),
  setGameSession: (session) => invoke("game:session", session),
  allowMicrophone: (enabled) => invoke("game:microphone", enabled),
  refreshDriver: () => invoke("driver:refresh"),
  installDriver: () => invoke("driver:install"),
  saveToken: (token) => invoke("token:save", token),
  removeToken: () => invoke("token:remove"),
  connect: () => invoke("discord:connect"),
  disconnect: () => invoke("discord:disconnect"),
  listChannels: (guildId) => invoke("discord:channels", guildId),
  join: (guildId, channelId) => invoke("discord:join", { guildId, channelId }),
  leave: () => invoke("discord:leave"),
  openLink: (link) => invoke("open", link),
  suspendShortcuts: (suspended) => invoke("shortcuts:suspend", suspended),
  onEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, message: AppEvent) =>
      callback(message);
    ipcRenderer.on("soundboard:event", listener);
    return () => ipcRenderer.removeListener("soundboard:event", listener);
  },
};
contextBridge.exposeInMainWorld("soundboard", api);
