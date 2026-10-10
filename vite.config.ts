import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  server: {
    // Allow-list only what the browser bundle imports. Everything else (server code,
    // private forecast model, .env, .git, docs, SQLite) is unreachable over HTTP.
    // Setting `deny` replaces Vite's defaults, so they are repeated here.
    fs: {
      strict: true,
      allow: [here("./src/web"), here("./src/case"), here("./node_modules")],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/*.sqlite*", "**/*.db*", "**/src/server/**", "**/src/engine/**"],
    },
    proxy: { "/api": "http://127.0.0.1:5174" },
  },
});
