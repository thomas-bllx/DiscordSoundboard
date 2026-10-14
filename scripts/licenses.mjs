import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  copyFile,
  access,
  rm,
} from "node:fs/promises";
import { resolve, join } from "node:path";

const output = resolve("resources/licenses");
await mkdir(output, { recursive: true });
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const frontend = new Set(["react", "react-dom", "scheduler", "lucide-react"]);
const entries = [];
for (const [location, info] of Object.entries(lock.packages)) {
  if (!location) continue;
  const name = location.split("node_modules/").at(-1);
  if (info.dev && !frontend.has(name)) continue;
  const root = resolve(location);
  let pkg;
  try {
    pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  } catch {
    continue;
  }
  const folder = join(
    output,
    `${pkg.name.replaceAll("/", "__").replaceAll("@", "")}-${pkg.version}`,
  );
  await mkdir(folder, { recursive: true });
  const filenames = await readdir(root);
  const notices = filenames.filter((name) =>
    /^(licen[cs]e|notice|copying|authors)/i.test(name),
  );
  for (const file of notices) {
    try {
      await copyFile(join(root, file), join(folder, file));
    } catch {
      /* A license directory is listed in manifest only. */
    }
  }
  await writeFile(
    join(folder, "package-info.json"),
    JSON.stringify(
      {
        name: pkg.name,
        version: pkg.version,
        license: pkg.license,
        repository: pkg.repository,
        author: pkg.author,
      },
      null,
      2,
    ),
  );
  entries.push({
    name: pkg.name,
    version: pkg.version,
    license: pkg.license,
    repository: pkg.repository,
    noticeFiles: notices,
  });
}
await copyFile("LICENSE", join(output, "APPLICATION-MIT.txt"));
await rm(join(output, "FFMPEG-GPLv3.txt"), { force: true });
await copyFile("vendor/ffmpeg/LICENSE", join(output, "FFMPEG-LGPLv2.1.txt"));
await copyFile("vendor/ffmpeg/README.txt", join(output, "FFMPEG-BUILD.txt"));
await copyFile("docs/THIRD_PARTY.md", join(output, "THIRD_PARTY.md"));
await access("vendor/ffmpeg/manifest.json");
await copyFile(
  "vendor/ffmpeg/manifest.json",
  join(output, "FFMPEG-MANIFEST.json"),
);
await copyFile("resources/legal/DAVEY-MIT.txt", join(output, "DAVEY-MIT.txt"));
await copyFile("resources/legal/VBCABLE-readme.txt", join(output, "VBCABLE-readme.txt"));
await writeFile(
  join(output, "PACKAGES.json"),
  JSON.stringify(entries, null, 2),
);
console.log(
  `Notices préparées pour ${entries.length} composants, FFmpeg et l’application.`,
);
