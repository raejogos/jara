import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      external: [
        "@tauri-apps/plugin-fs",
        "@tauri-apps/api",
        "@tauri-apps/plugin-shell",
        "@tauri-apps/plugin-dialog",
        "@tauri-apps/plugin-notification",
      ],
    },
  },
});

