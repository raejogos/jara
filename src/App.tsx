import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { UrlInput } from "./components/UrlInput";
import { VideoPreview } from "./components/VideoPreview";
import { FormatSelector } from "./components/FormatSelector";
import { DownloadList } from "./components/DownloadList";
import { Settings } from "./components/Settings";
import { About } from "./components/About";
import { ConvertPage } from "./components/ConvertPage";
import { SupportedServicesButton } from "./components/SupportedServices";
import { useDownload } from "./hooks/useDownload";
import { selectDirectory, platform, getDownloadUrl } from "./services/api";
import type { VideoInfo, VideoFormat, AppSettings } from "./types";

type Tab = "download" | "convert" | "queue" | "settings" | "about";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("download");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat | null>(null);
  const [audioOnly, setAudioOnly] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    defaultOutputPath: "",
    preferredAudioFormat: "mp3",
    preferredVideoQuality: "best",
  });

  const {
    downloads,
    isLoading,
    error,
    getVideoInfo,
    startDownload,
    cancelDownload,
    removeDownload,
    clearCompleted,
  } = useDownload();

  const handleTabChange = (tab: Tab) => {
    if (tab === "download") {
      setVideoInfo(null);
      setSelectedFormat(null);
      setAudioOnly(false);
    }
    setActiveTab(tab);
  };

  const handleUrlSubmit = async (url: string) => {
    setVideoInfo(null);
    setSelectedFormat(null);
    try {
      const info = await getVideoInfo(url);
      setVideoInfo(info);
    } catch {
      // Error is handled by the hook
    }
  };

  const handleDownload = async (outputPath: string) => {
    if (!videoInfo) return;

    await startDownload(
      videoInfo,
      audioOnly ? null : selectedFormat?.format_id || null,
      outputPath,
      audioOnly
    );

    setActiveTab("queue");
  };

  const activeDownloadsCount = downloads.filter(
    (d) => d.status === "downloading" || d.status === "processing"
  ).length;

  return (
    <div className="h-full flex bg-dark-950">
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        queueCount={activeDownloadsCount}
      />

      <main className="flex-1 overflow-hidden relative">
        {activeTab === "download" && (
          <>
            <div className="absolute top-0 left-0 right-0 flex justify-center py-4 z-10">
              <SupportedServicesButton />
            </div>

            <div className="h-full overflow-y-auto">
              <div className="min-h-full flex flex-col items-center justify-center p-8 animate-fade-in">
                <div className="w-full max-w-2xl space-y-6 pb-8">
                  <UrlInput onSubmit={handleUrlSubmit} isLoading={isLoading} error={error} />

                  {videoInfo && (
                    <div className="space-y-6 animate-slide-up">
                      <VideoPreview videoInfo={videoInfo} />

                      <FormatSelector
                        formats={videoInfo.formats}
                        selectedFormat={selectedFormat}
                        onSelectFormat={setSelectedFormat}
                        audioOnly={audioOnly}
                        onAudioOnlyChange={setAudioOnly}
                      />

                      <DownloadButton
                        onDownload={handleDownload}
                        defaultPath={settings.defaultOutputPath}
                        disabled={!videoInfo}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "convert" && (
          <div className="h-full animate-fade-in">
            <ConvertPage />
          </div>
        )}

        {activeTab === "queue" && (
          <div className="h-full p-8 animate-fade-in">
            <DownloadList
              downloads={downloads}
              onCancel={cancelDownload}
              onRemove={removeDownload}
              onClearCompleted={clearCompleted}
              onDownloadFile={platform.isWeb ? (id) => window.open(getDownloadUrl(id)) : undefined}
            />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="h-full p-8 overflow-y-auto animate-fade-in">
            <Settings settings={settings} onSettingsChange={setSettings} />
          </div>
        )}

        {activeTab === "about" && (
          <div className="h-full animate-fade-in">
            <About />
          </div>
        )}
      </main>
    </div>
  );
}

interface DownloadButtonProps {
  onDownload: (outputPath: string) => void;
  defaultPath: string;
  disabled: boolean;
}

function DownloadButton({ onDownload, defaultPath, disabled }: DownloadButtonProps) {
  const [outputPath, setOutputPath] = useState(defaultPath || "");

  const handleSelectFolder = async () => {
    const selected = await selectDirectory();
    if (selected) {
      setOutputPath(selected);
    }
  };

  // On web, downloads go to server's downloads folder
  const effectivePath = platform.isWeb ? "server" : outputPath;
  const showPathSelector = platform.isTauri;

  return (
    <div className="glass rounded-xl p-6">
      {showPathSelector && (
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
            placeholder="pasta de destino..."
            className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-dark-400 transition-colors text-sm"
          />
          <button
            onClick={handleSelectFolder}
            className="px-4 py-3 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </button>
        </div>
      )}

      {platform.isWeb && (
        <p className="text-xs text-gray-500 mb-4">
          o arquivo será disponibilizado para download após a conversão
        </p>
      )}

      <button
        onClick={() => onDownload(effectivePath)}
        disabled={disabled || (showPathSelector && !outputPath)}
        className="w-full py-4 bg-white text-black rounded-xl font-semibold hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        baixar
      </button>
    </div>
  );
}

export default App;
