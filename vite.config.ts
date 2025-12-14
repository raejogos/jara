import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Plugin to stub Tauri modules in web/dev mode
function stubTauriModules(): Plugin {
  const tauriModules = [
    "@tauri-apps/plugin-fs",
    "@tauri-apps/api",
    "@tauri-apps/api/core",
    "@tauri-apps/plugin-shell",
    "@tauri-apps/plugin-dialog",
    "@tauri-apps/plugin-notification",
  ];

  return {
    name: "stub-tauri-modules",
    enforce: "pre",
    resolveId(id) {
      if (tauriModules.some(mod => id === mod || id.startsWith(mod + "/"))) {
        return { id: `\0virtual:${id}`, moduleSideEffects: false };
      }
      return null;
    },
    load(id) {
      if (id.startsWith("\0virtual:@tauri-apps/")) {
        // Return empty module - these will only be imported dynamically when isTauri is true
        return "export default {}; export const BaseDirectory = {}; export const readTextFile = () => Promise.resolve(''); export const writeTextFile = () => Promise.resolve(); export const exists = () => Promise.resolve(false); export const mkdir = () => Promise.resolve(); export const open = () => Promise.resolve(null); export const invoke = () => Promise.resolve(null);";
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [stubTauriModules(), react()],
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

