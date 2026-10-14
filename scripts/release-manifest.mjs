import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat, writeFile, copyFile, readFile } from "node:fs/promises";
import { join } from "node:path";
const files = [];
for (const filename of await readdir("release")) {
  if (!filename.endsWith(".exe")) continue;
  const path = join("release", filename);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  files.push({
    file: filename,
    bytes: (await stat(path)).size,
    sha256: hash.digest("hex"),
  });
}
const { version } = JSON.parse(await readFile("package.json", "utf8"));
await writeFile(
  "release/SHA256SUMS.json",
  JSON.stringify({ version, files }, null, 2),
);
await copyFile("docs/VALIDATION.md", "release/VALIDATION.md");
await copyFile(
  "docs/VALIDATION.md",
  "release/win-unpacked/resources/docs/VALIDATION.md",
);
console.log(JSON.stringify(files, null, 2));
