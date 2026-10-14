import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat, writeFile, copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";
const files = [];
const { version } = JSON.parse(await readFile("package.json", "utf8"));
// Publish only this version's approved artifacts, never every file in release/.
const filenames = [
  `Local-Discord-Soundboard-${version}-x64-nsis.exe`,
  `Local-Discord-Soundboard-${version}-x64-portable.exe`,
  "ffmpeg-9.0.2-soundboard-win64.zip",
  "ffmpeg-9.0.2-soundboard-sources.zip",
];
for (const filename of filenames) {
  const path = join("release", filename);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  files.push({
    file: filename,
    bytes: (await stat(path)).size,
    sha256: hash.digest("hex"),
  });
}
await writeFile(
  "release/SHA256SUMS.json",
  JSON.stringify({ version, files }, null, 2),
);
await copyFile("docs/VALIDATION.md", "release/VALIDATION.md");
await copyFile(
  "docs/THIRD_PARTY.md",
  "release/THIRD_PARTY.md",
);
await writeFile("release/SHA256SUMS.txt", files.map((file) => `${file.sha256}  ${file.file}`).join("\n") + "\n");
console.log(JSON.stringify(files, null, 2));
