import { copyFile, stat, unlink } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { ImportReport, Sound } from "../shared/model";
import { UserError, publicError } from "../shared/errors";
import type { ConfigStore } from "./store";

export function demuxer(path: string): string {
  const extension = extname(path).toLowerCase();
  if (![".mp3", ".wav", ".ogg"].includes(extension))
    throw new UserError("Formats acceptés : MP3, WAV et OGG.");
  return extension.slice(1);
}

export async function probeAudio(
  ffmpeg: string,
  path: string,
): Promise<number | null> {
  const format = demuxer(path);
  return new Promise((resolve, reject) => {
    // Force a local audio demuxer: disguised playlists cannot trigger network requests.
    const child = spawn(
      ffmpeg,
      [
        "-nostdin",
        "-hide_banner",
        "-protocol_whitelist",
        "file,pipe",
        "-f",
        format,
        "-i",
        path,
        "-map",
        "0:a:0",
        "-t",
        "0.05",
        "-f",
        "null",
        "-",
      ],
      { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
    );
    let diagnostic = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 20_000);
    child.stderr.on("data", (data: Buffer) => {
      diagnostic = (diagnostic + data.toString()).slice(-12000);
    });
    child.on("error", () => {
      clearTimeout(timer);
      reject(
        new UserError("FFmpeg est indisponible. Réinstallez l’application."),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0)
        return reject(
          new UserError(
            timedOut
              ? "Analyse du fichier trop lente. Vérifiez son accessibilité."
              : "Ce fichier audio est illisible ou endommagé.",
          ),
        );
      const duration = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(
        diagnostic,
      );
      resolve(
        duration
          ? Number(duration[1]) * 3600 +
              Number(duration[2]) * 60 +
              Number(duration[3])
          : null,
      );
    });
  });
}

export class AudioLibrary {
  importing = false;
  constructor(
    private store: ConfigStore,
    private ffmpeg: string,
    private changed: () => void,
  ) {}
  path(sound: Sound): string {
    return join(this.store.root, "library", sound.file);
  }
  async import(paths: string[]): Promise<ImportReport> {
    if (this.importing)
      throw new UserError("Une importation est déjà en cours.");
    this.importing = true;
    this.changed();
    const report: ImportReport = { imported: 0, failures: [] };
    const profileId = this.store.value.activeProfileId;
    try {
      for (const path of [...new Set(paths)]) {
        let copied: string | undefined;
        try {
          const extension = demuxer(path);
          const info = await stat(path);
          if (!info.isFile() || info.size === 0)
            throw new UserError("Le fichier est vide ou invalide.");
          const id = randomUUID();
          const file = `${id}.${extension}`;
          copied = join(this.store.root, "library", file);
          // Copy first: later edits/removal of the source cannot change validation results.
          await copyFile(path, copied);
          const duration = await probeAudio(this.ffmpeg, copied);
          const sound: Sound = {
            id,
            profileId,
            file,
            name: basename(path, extname(path)).slice(0, 80) || "Nouveau son",
            color: ["#66e3c4", "#9d9bff", "#f6bf73", "#f68cad"][
              report.imported % 4
            ]!,
            icon: "♪",
            shortcut: "",
            volume: 1,
            duration,
            favorite: false,
          };
          await this.store.change((config) => {
            if (!config.profiles.some((p) => p.id === profileId))
              sound.profileId = config.activeProfileId;
            config.sounds.push(sound);
          });
          report.imported++;
          this.changed();
        } catch (error) {
          if (copied) await unlink(copied).catch(() => {});
          report.failures.push(`${basename(path)} : ${publicError(error)}`);
        }
      }
    } finally {
      this.importing = false;
      this.changed();
    }
    return report;
  }
}
