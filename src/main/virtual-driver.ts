import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import type { DriverState } from "../shared/model";
import { UserError } from "../shared/errors";
import { cableAvailability, cableEndpointQuery } from "./audio-endpoints";

export const CABLE_SHA256 =
  "b950e39f01af1d04ea623c8f6d8eb9b6ea5c477c637295fabf20631c85116bfb";
const exec = promisify(execFile);
export const psQuote = (text: string) => `'${text.replaceAll("'", "''")}'`;
const powershell = join(
  process.env.SystemRoot || "C:\\Windows",
  "System32/WindowsPowerShell/v1.0/powershell.exe",
);
async function run(script: string, timeout = 20_000): Promise<string> {
  const { stdout } = await exec(
    powershell,
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      windowsHide: true,
      timeout,
      maxBuffer: 1024 * 1024,
    },
  );
  return stdout.trim();
}

export class VirtualDriver {
  state: DriverState = {
    status: "checking",
    message: "Vérification du composant audio…",
  };
  private busy = false;
  private installedThisSession = false;
  constructor(
    private archive: string,
    private dataDir: string,
    private changed: () => void,
    private execute: typeof run = run,
  ) {}
  private set(status: DriverState["status"], message: string): DriverState {
    this.state = { status, message };
    this.changed();
    return this.state;
  }
  private async availability() {
    return cableAvailability(await this.execute(cableEndpointQuery));
  }
  private detected(
    availability: ReturnType<typeof cableAvailability>,
  ): DriverState {
    switch (availability) {
      case "present":
        return this.set(
          "installed",
          "VB-CABLE est disponible. Choisissez CABLE Output comme micro dans l’application souhaitée.",
        );
      case "disabled":
        return this.set(
          "disabled",
          "VB-CABLE est installé, mais désactivé dans Windows. Dans les réglages audio, activez CABLE Input (Lecture) et CABLE Output (Enregistrement), puis cliquez sur Actualiser. Inutile de réinstaller le composant.",
        );
      case "unavailable":
        return this.set(
          "unavailable",
          "VB-CABLE est présent, mais ses deux périphériques ne sont pas disponibles. Vérifiez CABLE Input et CABLE Output dans les réglages audio Windows, puis actualisez. Redémarrez Windows si l’installation vient de se terminer.",
        );
      case "missing":
        return this.installedThisSession
          ? this.set(
              "restart",
              "L’installation s’est terminée. Redémarrez Windows pour activer le périphérique, puis actualisez.",
            )
          : this.set(
              "missing",
              "Installez le composant audio inclus pour utiliser le vocal des jeux.",
            );
    }
  }
  async refresh(): Promise<DriverState> {
    if (this.busy) return this.state;
    try {
      return this.detected(await this.availability());
    } catch {
      return this.set(
        "error",
        "Impossible de vérifier les périphériques Windows. Réessayez avant d’installer le composant.",
      );
    }
  }
  async install(): Promise<DriverState> {
    if (this.busy) throw new UserError("L’installation est déjà en cours.");
    this.busy = true;
    try {
      const before = await this.availability();
      if (before !== "missing") return this.detected(before);
      this.set(
        "installing",
        "Préparation du pilote inclus. Validez la demande administrateur de Windows.",
      );
      const bytes = await readFile(this.archive);
      if (createHash("sha256").update(bytes).digest("hex") !== CABLE_SHA256)
        throw new Error("archive");
      await mkdir(this.dataDir, { recursive: true });
      const folder = await mkdtemp(join(this.dataDir, "vb-cable-"));
      const verifiedArchive = join(folder, "verified-package.zip");
      await writeFile(verifiedArchive, bytes);
      // The unmodified, pinned archive is extracted into a new private app folder.
      await this.execute(`$ErrorActionPreference = 'Stop'
Expand-Archive -LiteralPath ${psQuote(verifiedArchive)} -DestinationPath ${psQuote(folder)}
$signature = Get-AuthenticodeSignature -LiteralPath ${psQuote(join(folder, "VBCABLE_Setup_x64.exe"))}
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'BUREL VINCENT') { throw 'Invalid vendor signature' }`);
      const result = await this.execute(
        `$ErrorActionPreference = 'Stop'
try {
  $process = Start-Process -FilePath ${psQuote(join(folder, "VBCABLE_Setup_x64.exe"))} -WorkingDirectory ${psQuote(folder)} -ArgumentList '-i','-h' -Verb RunAs -WindowStyle Hidden -Wait -PassThru
  'exit:' + $process.ExitCode
} catch {
  if ($_.Exception.NativeErrorCode -eq 1223 -or $_.Exception.InnerException.NativeErrorCode -eq 1223) { 'cancelled' } else { throw }
}`,
        10 * 60_000,
      );
      if (result === "cancelled") {
        return this.set(
          "missing",
          "Installation annulée dans Windows. Vous pouvez la relancer ici.",
        );
      }
      // An exit code alone never proves that a usable driver exists.
      const after = await this.availability();
      if (after === "present") {
        this.installedThisSession = true;
        return this.set(
          "installed",
          "Composant installé. VB-Audio recommande de redémarrer Windows avant utilisation.",
        );
      }
      if (after !== "missing") return this.detected(after);
      if (result === "exit:0" || result === "exit:3010") {
        this.installedThisSession = true;
        return this.set(
          "restart",
          "Installation terminée, périphérique pas encore actif. Redémarrez Windows puis actualisez.",
        );
      }
      throw new Error("setup");
    } catch {
      return this.set(
        "error",
        "Installation non confirmée. Réessayez après un redémarrage. Le pilote inclus est vérifié avant son lancement ; aucune signature Windows n’est contournée.",
      );
    } finally {
      this.busy = false;
    }
  }
}
