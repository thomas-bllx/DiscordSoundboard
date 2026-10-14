import {
  mkdir,
  readFile,
  rename,
  writeFile,
  copyFile,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";
import {
  ConfigSchema,
  readConfig,
  defaultConfig,
  type Config,
} from "../shared/model";
import { UserError } from "../shared/errors";
import { validateShortcuts } from "../shared/shortcuts";

export async function atomicWrite(
  path: string,
  data: string | Buffer,
): Promise<void> {
  const temp = `${path}.tmp`;
  await writeFile(temp, data, { mode: 0o600, flush: true });
  await rename(temp, path);
}

export class ConfigStore {
  private config = defaultConfig();
  private queue: Promise<unknown> = Promise.resolve();
  warning: string | null = null;
  readonly file: string;
  constructor(readonly root: string) {
    this.file = join(root, "config.json");
  }
  get value(): Config {
    return structuredClone(this.config);
  }

  async load(): Promise<void> {
    await mkdir(join(this.root, "library"), { recursive: true });
    let contents: string;
    try {
      contents = await readFile(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await atomicWrite(this.file, JSON.stringify(this.config, null, 2));
      return;
    }
    // Future versions must not be silently overwritten by this application.
    try {
      const raw: unknown = JSON.parse(contents);
      if (
        raw &&
        typeof raw === "object" &&
        "version" in raw &&
        raw.version !== 1 &&
        raw.version !== 2
      ) {
        throw new UserError(
          "Cette bibliothèque vient d’une autre version. Utilisez une version compatible de l’application.",
        );
      }
      this.config = readConfig(raw);
      validateShortcuts(this.config);
      if ((raw as { version?: number }).version === 1) {
        await copyFile(this.file, `${this.file}.v1-${Date.now()}.bak`);
        await atomicWrite(this.file, JSON.stringify(this.config, null, 2));
      }
    } catch (error) {
      if (
        error instanceof UserError &&
        error.message.startsWith("Cette bibliothèque")
      )
        throw error;
      await copyFile(this.file, `${this.file}.corrupt-${Date.now()}`);
      try {
        this.config = readConfig(
          JSON.parse(await readFile(`${this.file}.bak`, "utf8")),
        );
        validateShortcuts(this.config);
        this.warning =
          "Configuration endommagée : la sauvegarde précédente a été restaurée. Le fichier original a été conservé.";
      } catch {
        this.config = defaultConfig();
        this.warning =
          "Configuration illisible : une bibliothèque vide a été ouverte. Vos fichiers audio et la configuration originale ont été conservés dans le dossier de données.";
      }
      await atomicWrite(this.file, JSON.stringify(this.config, null, 2));
    }
  }

  async change(edit: (draft: Config) => void): Promise<void> {
    const operation = this.queue.then(async () => {
      const draft = this.value;
      edit(draft);
      const valid = ConfigSchema.parse(draft);
      validateShortcuts(valid);
      await copyFile(this.file, `${this.file}.bak`);
      await atomicWrite(this.file, JSON.stringify(valid, null, 2));
      this.config = valid;
    });
    this.queue = operation.catch(() => {});
    await operation;
  }
}

export interface EncryptionProvider {
  available(): boolean;
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}
export class TokenVault {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private file: string,
    private encryption: EncryptionProvider,
  ) {}
  available(): boolean {
    return this.encryption.available();
  }
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.tail.then(operation);
    this.tail = next.catch(() => {});
    return next;
  }
  async present(): Promise<boolean> {
    try {
      await readFile(this.file);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
  save(token: string): Promise<void> {
    return this.serialize(async () => {
      if (!this.available())
        throw new UserError(
          "Le coffre sécurisé Windows est indisponible. Le token n’a pas été enregistré.",
        );
      await atomicWrite(this.file, this.encryption.encrypt(token));
    });
  }
  read(): Promise<string> {
    return this.serialize(async () => {
      if (!this.available())
        throw new UserError("Le coffre sécurisé Windows est indisponible.");
      try {
        return this.encryption.decrypt(await readFile(this.file));
      } catch {
        throw new UserError(
          "Token absent ou impossible à déchiffrer. Saisissez à nouveau le token du bot.",
        );
      }
    });
  }
  remove(): Promise<void> {
    return this.serialize(async () => {
      try {
        await unlink(this.file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    });
  }
}
