import { build } from "esbuild";
import { build as viteBuild } from "vite";
import "./icon.mjs";
await build({
  entryPoints: { index: "src/main/index.ts", worker: "src/engine/worker.ts" },
  outdir: "dist/main",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  packages: "external",
  sourcemap: true,
});
await build({
  entryPoints: ["src/preload/index.ts"],
  outfile: "dist/preload/index.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node24",
  external: ["electron"],
});
await viteBuild();
