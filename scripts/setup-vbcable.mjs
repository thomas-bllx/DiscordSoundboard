import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const destination = new URL(
  "../vendor/vb-cable/VBCABLE_Driver_Pack45.zip",
  import.meta.url,
);
const expected =
  "b950e39f01af1d04ea623c8f6d8eb9b6ea5c477c637295fabf20631c85116bfb";
let bytes;
try {
  bytes = await readFile(destination);
} catch {}
if (!bytes) {
  const response = await fetch(
    "https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip",
    { signal: AbortSignal.timeout(60_000) },
  );
  if (!response.ok) throw new Error("Téléchargement VB-CABLE impossible.");
  bytes = Buffer.from(await response.arrayBuffer());
}
if (createHash("sha256").update(bytes).digest("hex") !== expected)
  throw new Error(
    "Archive VB-CABLE inattendue. Vérifier la provenance avant de modifier l’empreinte.",
  );
await mkdir(new URL("../vendor/vb-cable/", import.meta.url), {
  recursive: true,
});
await writeFile(destination, bytes);
console.log(
  "VB-CABLE Pack45 vérifié, prêt à être inclus. Aucun pilote installé.",
);
