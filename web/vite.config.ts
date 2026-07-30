import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: Vite serves the UI on :5173 and proxies API calls to the backend on
// :3000 (same-origin in the browser, no CORS). Prod: `vite build` -> dist/,
// which Fastify serves via @fastify/static.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/scans": "http://localhost:3000",
    },
  },
  build: { outDir: "dist" },
});
