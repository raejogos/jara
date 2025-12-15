import { useState } from "react";
import { platform } from "../services/api";
import type { AppSettings } from "../types";

const CURRENT_VERSION = "1.2.0";
const GITHUB_RELEASES_URL = "https://api.github.com/repos/raejogos/jara/releases/latest";
const DOWNLOAD_URL = "https://github.com/raejogos/jara/releases/latest";

interface SettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export function Settings({ settings, onSettingsChange }: SettingsProps) {
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "available" | "up-to-date" | "error">("idle");
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  const checkForUpdates = async () => {
    setUpdateStatus("checking");
    try {
      const response = await fetch(GITHUB_RELEASES_URL);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      const latest = data.tag_name?.replace("v", "") || data.name;
      setLatestVersion(latest);

      if (latest && latest !== CURRENT_VERSION) {
        setUpdateStatus("available");
      } else {
        setUpdateStatus("up-to-date");
      }
    } catch {
      setUpdateStatus("error");
    }
  };
  const handleSelectDefaultFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Selecione a pasta padrão de downloads",
      });

      if (selected && typeof selected === "string") {
        onSettingsChange({ ...settings, defaultOutputPath: selected });
      }
    } catch (e) {
      console.error("Failed to open folder dialog:", e);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-4 font-mono">configurações</h2>

      {/* Default output path - Desktop only */}
      {platform.isTauri && (
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white text-sm">pasta de downloads</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.defaultOutputPath}
              onChange={(e) =>
                onSettingsChange({ ...settings, defaultOutputPath: e.target.value })
              }
              placeholder="selecione a pasta..."
              className="flex-1 bg-dark-900 border border-dark-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-dark-500 transition-colors"
            />
            <button
              onClick={handleSelectDefaultFolder}
              className="px-3 py-2 bg-dark-700 hover:bg-dark-600 rounded text-xs text-gray-400 transition-colors"
            >
              procurar
            </button>
          </div>
        </div>
      )}

      {/* Audio format */}
      <div className="bg-dark-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm">formato de áudio</span>
          <div className="flex gap-1">
            {["mp3", "m4a", "opus", "flac"].map((format) => (
              <button
                key={format}
                onClick={() =>
                  onSettingsChange({ ...settings, preferredAudioFormat: format })
                }
                className={`px-2 py-1 rounded text-xs transition-all ${settings.preferredAudioFormat === format
                  ? "bg-white text-black"
                  : "bg-dark-700 text-gray-500 hover:text-gray-300"
                  }`}
              >
                {format}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Video quality */}
      <div className="bg-dark-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm">qualidade de vídeo</span>
          <div className="flex gap-1">
            {[
              { id: "best", label: "melhor" },
              { id: "1080p", label: "1080p" },
              { id: "720p", label: "720p" },
              { id: "480p", label: "480p" },
            ].map((quality) => (
              <button
                key={quality.id}
                onClick={() =>
                  onSettingsChange({ ...settings, preferredVideoQuality: quality.id })
                }
                className={`px-2 py-1 rounded text-xs transition-all ${settings.preferredVideoQuality === quality.id
                  ? "bg-white text-black"
                  : "bg-dark-700 text-gray-500 hover:text-gray-300"
                  }`}
              >
                {quality.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toggles section */}
      <div className="bg-dark-800 rounded-lg divide-y divide-dark-700">
        {/* Notifications */}
        <div className="p-4 flex items-center justify-between">
          <span className="text-white text-sm">notificações</span>
          <div
            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${settings.notificationsEnabled ? "bg-white" : "bg-dark-600"
              }`}
            onClick={() => onSettingsChange({ ...settings, notificationsEnabled: !settings.notificationsEnabled })}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${settings.notificationsEnabled ? "translate-x-5 bg-black" : "translate-x-0.5 bg-gray-500"
                }`}
            />
          </div>
        </div>

        {/* Animated Background */}
        <div className="p-4 flex items-center justify-between">
          <span className="text-white text-sm">fundo animado</span>
          <div
            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${settings.animatedBackground ? "bg-white" : "bg-dark-600"
              }`}
            onClick={() => onSettingsChange({ ...settings, animatedBackground: !settings.animatedBackground })}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${settings.animatedBackground ? "translate-x-5 bg-black" : "translate-x-0.5 bg-gray-500"
                }`}
            />
          </div>
        </div>
      </div>

      {/* Updates - Desktop only */}
      {platform.isTauri && (
        <div className="bg-dark-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white text-sm">versão</span>
            <span className="text-gray-500 text-xs font-mono">v{CURRENT_VERSION}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={checkForUpdates}
              disabled={updateStatus === "checking"}
              className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded text-xs text-gray-400 transition-colors disabled:opacity-50"
            >
              {updateStatus === "checking" ? "verificando..." : "verificar atualizações"}
            </button>

            {updateStatus === "up-to-date" && (
              <span className="text-xs text-green-400">atualizado</span>
            )}

            {updateStatus === "error" && (
              <span className="text-xs text-gray-500">erro</span>
            )}
          </div>

          {updateStatus === "available" && latestVersion && (
            <div className="mt-3 p-3 bg-dark-900 rounded">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  nova versão: <span className="text-green-400 font-mono">v{latestVersion}</span>
                </span>
                <a
                  href={DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 bg-white text-black rounded text-xs hover:bg-gray-200 transition-colors"
                >
                  baixar
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-gray-700 text-xs font-mono pt-4">
        jara — tempo livre mal investido
      </p>
    </div>
  );
}
