import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import preact from "@preact/preset-vite";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  build: {
    target: "es2022",
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
