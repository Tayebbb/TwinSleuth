import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  server: {
    fs: { deny: ["**/*.sqlite*", "**/*.db*"] },
    proxy: { "/api": "http://127.0.0.1:5174" },
  },
});
