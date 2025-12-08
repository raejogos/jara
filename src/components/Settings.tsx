import type { AppSettings } from "../types";

interface SettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export function Settings({ settings, onSettingsChange }: SettingsProps) {
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
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold mb-6 text-white">Configurações</h2>

      {/* Default output path */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-200">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          Pasta Padrão de Downloads
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Defina a pasta onde os downloads serão salvos por padrão.
        </p>

        <div className="flex gap-3">
          <input
            type="text"
            value={settings.defaultOutputPath}
            onChange={(e) =>
              onSettingsChange({ ...settings, defaultOutputPath: e.target.value })
            }
            placeholder="Selecione ou digite o caminho..."
            className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-dark-400 transition-colors"
          />
          <button
            onClick={handleSelectDefaultFolder}
            className="px-4 py-3 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg transition-colors text-gray-300"
          >
            Procurar
          </button>
        </div>
      </div>

      {/* Audio format */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-200">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          Formato de Áudio Preferido
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Formato usado quando a opção "Apenas áudio" está habilitada.
        </p>

        <div className="flex gap-3">
          {["mp3", "m4a", "opus", "flac"].map((format) => (
            <button
              key={format}
              onClick={() =>
                onSettingsChange({ ...settings, preferredAudioFormat: format })
              }
              className={`px-4 py-2 rounded-lg border transition-all ${
                settings.preferredAudioFormat === format
                  ? "border-white bg-white text-black"
                  : "border-dark-600 bg-dark-800 text-gray-400 hover:border-dark-500"
              }`}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Video quality */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-200">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Qualidade de Vídeo Preferida
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Qualidade padrão quando nenhuma é selecionada manualmente.
        </p>

        <div className="flex flex-wrap gap-3">
          {[
            { id: "best", label: "Melhor disponível" },
            { id: "1080p", label: "1080p" },
            { id: "720p", label: "720p" },
            { id: "480p", label: "480p" },
          ].map((quality) => (
            <button
              key={quality.id}
              onClick={() =>
                onSettingsChange({ ...settings, preferredVideoQuality: quality.id })
              }
              className={`px-4 py-2 rounded-lg border transition-all ${
                settings.preferredVideoQuality === quality.id
                  ? "border-white bg-white text-black"
                  : "border-dark-600 bg-dark-800 text-gray-400 hover:border-dark-500"
              }`}
            >
              {quality.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
