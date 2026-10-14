import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(import.meta.dirname, "src/renderer"),
  base: "./",
  plugins: [
    react(),
    {
      name: "local-development-csp",
      transformIndexHtml(html, context) {
        // Vite injects a refresh preamble only in local development. Production remains strict.
        return context.server
          ? html.replace(
              "script-src 'self'",
              "script-src 'self' 'unsafe-inline'",
            )
          : html;
      },
    },
  ],
  build: { outDir: "../../dist/renderer", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
