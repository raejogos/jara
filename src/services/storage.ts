// Storage abstraction - Tauri uses file, Web uses localStorage
import { platform } from "./api";
import type { AppSettings } from "../types";

const STORAGE_KEY = "jara_settings";

const DEFAULT_SETTINGS: AppSettings = {
  defaultOutputPath: "",
  preferredAudioFormat: "mp3",
  preferredVideoQuality: "best",
  notificationsEnabled: true,
  animatedBackground: true,
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    if (platform.isTauri) {
      // Tauri: load from app data directory
      // @ts-ignore - Tauri plugin only available in desktop app
      const { BaseDirectory, readTextFile, exists } = await import("@tauri-apps/plugin-fs");

      const fileExists = await exists("settings.json", { baseDir: BaseDirectory.AppData });
      if (!fileExists) {
        return DEFAULT_SETTINGS;
      }

      const content = await readTextFile("settings.json", { baseDir: BaseDirectory.AppData });
      return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
    } else {
      // Web: load from localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return DEFAULT_SETTINGS;
      }
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    if (platform.isTauri) {
      // Tauri: save to app data directory
      // @ts-ignore - Tauri plugin only available in desktop app
      const { BaseDirectory, writeTextFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");

      // Ensure directory exists
      const dirExists = await exists("", { baseDir: BaseDirectory.AppData });
      if (!dirExists) {
        await mkdir("", { baseDir: BaseDirectory.AppData, recursive: true });
      }

      await writeTextFile("settings.json", JSON.stringify(settings, null, 2), {
        baseDir: BaseDirectory.AppData
      });
    } else {
      // Web: save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

