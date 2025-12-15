import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { UrlInput } from "./components/UrlInput";
import { VideoPreview } from "./components/VideoPreview";
import { FormatSelector } from "./components/FormatSelector";
import { DownloadList } from "./components/DownloadList";
import { Settings } from "./components/Settings";
import { About } from "./components/About";
import { ConvertPage } from "./components/ConvertPage";
import { PlaylistPreview } from "./components/PlaylistPreview";
import { SupportedServicesButton } from "./components/SupportedServices";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { GradientBackground } from "./components/GradientBackground";
import { HomePage } from "./components/HomePage"; // Import HomePage
import { useDownload } from "./hooks/useDownload";
import { selectDirectory, platform, getDownloadUrl } from "./services/api";
import { loadSettings, saveSettings } from "./services/storage";
import type { VideoInfo, VideoFormat, AppSettings, PlaylistInfo } from "./types";

type Tab = "download" | "convert" | "queue" | "settings" | "about" | "home";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home"); // Default to home
  const [initialAction, setInitialAction] = useState<string | undefined>(undefined);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat | null>(null);
  const [audioOnly, setAudioOnly] = useState(false);
  const [isAudioService, setIsAudioService] = useState(false);
  const [downloadSubs, setDownloadSubs] = useState(false);
  const [subLang, setSubLang] = useState("pt,en");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showYoutubeWarning, setShowYoutubeWarning] = useState(!platform.isTauri);
  const [initialUrl, setInitialUrl] = useState<string | undefined>(undefined);

  // Load settings on mount
  useEffect(() => {
    loadSettings().then((loaded) => {
      setSettings(loaded);
      setSettingsLoaded(true);
    });
  }, []);

  // Save settings when they change
  useEffect(() => {
    if (settingsLoaded && settings) {
      saveSettings(settings);
    }
  }, [settings, settingsLoaded]);

  const {
    downloads,
    isLoading,
    error,
    setNotificationsEnabled,
    getVideoInfo,
    getPlaylistInfo,
    isPlaylist,
    startDownload,
    startBatchDownload,
    cancelDownload,
    removeDownload,
    clearCompleted,
  } = useDownload();

  // Sync notifications setting with hook
  const handleSettingsChange = (newSettings: AppSettings) => {
    setSettings(newSettings);
    setNotificationsEnabled(newSettings.notificationsEnabled);
  };

  const handleTabChange = (tab: Tab) => {
    if (tab === "download") {
      setVideoInfo(null);
      setPlaylistInfo(null);
      setSelectedFormat(null);
      setAudioOnly(false);
      setIsAudioService(false);
    }
    // Clear initial action when manually changing tabs, unless coming from Home
    if (tab !== "convert") {
      setInitialAction(undefined);
    }
    setActiveTab(tab);
  };

  const handleNavigate = (tab: "convert" | "download", action?: string, url?: string) => {
    if (tab === "convert" && action) {
      setInitialAction(action);
    } else if (tab === "download" && action === "download-audio") {
      setAudioOnly(true);
      setIsAudioService(true);
    } else if (tab === "download") {
      // Reset if just navigating to download without specific audio intent
      setAudioOnly(false);
      setIsAudioService(false);
    }
    // If URL is provided, set it for UrlInput
    if (url) {
      setInitialUrl(url);
    }
    setActiveTab(tab);
  };

  // Helper to detect audio-only services
  const isAudioOnlyService = (url: string): boolean => {
    const audioServices = [
      'soundcloud.com',
      'spotify.com',
      'open.spotify.com',
      'music.apple.com',
      'deezer.com',
      'bandcamp.com',
      'audiomack.com',
      'mixcloud.com',
    ];
    return audioServices.some(service => url.includes(service));
  };

  const handleUrlSubmit = async (url: string) => {
    setVideoInfo(null);
    setPlaylistInfo(null);
    setSelectedFormat(null);

    // Auto-detect audio services
    const isAudio = isAudioOnlyService(url);
    setIsAudioService(isAudio);
    if (isAudio) {
      setAudioOnly(true);
    }

    try {
      // Check if it's a playlist
      const isPlaylistUrl = await isPlaylist(url);

      if (isPlaylistUrl) {
        const info = await getPlaylistInfo(url);
        setPlaylistInfo(info);
      } else {
        const info = await getVideoInfo(url);
        setVideoInfo(info);
      }
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
      audioOnly,
      downloadSubs,
      subLang
    );

    setActiveTab("queue");
  };

  const handleBatchSubmit = async (urls: string[]) => {
    // For batch, use default path or ask for one
    const outputPath = settings?.defaultOutputPath || (platform.isWeb ? "server" : "");

    if (!outputPath && platform.isTauri) {
      // Need to select a folder first
      const selected = await selectDirectory();
      if (selected) {
        await startBatchDownload(urls, selected, false);
        setActiveTab("queue");
      }
    } else {
      await startBatchDownload(urls, outputPath, false);
      setActiveTab("queue");
    }
  };

  const handlePlaylistDownload = async (urls: string[]) => {
    const outputPath = settings?.defaultOutputPath || (platform.isWeb ? "server" : "");

    if (!outputPath && platform.isTauri) {
      const selected = await selectDirectory();
      if (selected) {
        await startBatchDownload(urls, selected, audioOnly);
        setActiveTab("queue");
      }
    } else {
      await startBatchDownload(urls, outputPath, audioOnly);
      setActiveTab("queue");
    }
  };

  const activeDownloadsCount = downloads.filter(
    (d) => d.status === "downloading" || d.status === "processing"
  ).length;

  return (
    <div className="h-full flex bg-dark-950 relative">
      <GradientBackground />
      <AnimatedBackground enabled={settings?.animatedBackground ?? true} />
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        queueCount={activeDownloadsCount}
      />

      <main className="flex-1 overflow-hidden relative">
        {/* YouTube Warning Badge */}
        {showYoutubeWarning && (
          <div className="absolute top-4 right-4 z-20 max-w-xs animate-fade-in">
            <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 shadow-lg">
              <button
                onClick={() => setShowYoutubeWarning(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex items-start gap-3 pr-4">
                <span className="text-2xl">🦫</span>
                <div>
                  <p className="text-white text-sm font-medium mb-1">YouTube?</p>
                  <p className="text-gray-400 text-xs">
                    Pra baixar do YouTube, use o{" "}
                    <a
                      href="https://github.com/raejogos/jara/releases/download/v1.2.0/Jara_1.2.0_x64-setup.exe"
                      className="text-white underline hover:text-gray-300"
                    >
                      app desktop
                    </a>
                    !
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Home Tab */}
        {activeTab === "home" && (
          <div className="h-full animate-fade-in relative">
            <HomePage onNavigate={handleNavigate} />
          </div>
        )}

        {/* Download Tab */}
        {activeTab === "download" && (
          <>
            <div className="absolute top-0 left-0 right-0 flex justify-center py-4 z-10">
              <SupportedServicesButton />
            </div>

            <div className="h-full overflow-y-auto">
              <div className="min-h-full flex flex-col items-center justify-center p-8 animate-fade-in">
                <div className="w-full max-w-2xl space-y-8 pb-8">

                  {/* Logo centralizada */}
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <img
                      src="/icon.png"
                      alt="Jara Logo"
                      className="w-20 h-20 object-contain"
                    />
                    <span
                      className="text-4xl text-white"
                      style={{ fontFamily: "'Press Start 2P', cursive" }}
                    >
                      jara
                    </span>
                  </div>

                  <UrlInput
                    onSubmit={handleUrlSubmit}
                    onBatchSubmit={handleBatchSubmit}
                    isLoading={isLoading}
                    error={error}
                    initialUrl={initialUrl}
                    onInitialUrlConsumed={() => setInitialUrl(undefined)}
                  />

                  {videoInfo && (
                    <div className="space-y-6 animate-slide-up">
                      <VideoPreview videoInfo={videoInfo} />

                      <FormatSelector
                        formats={videoInfo.formats}
                        selectedFormat={selectedFormat}
                        onSelectFormat={setSelectedFormat}
                        audioOnly={audioOnly}
                        onAudioOnlyChange={setAudioOnly}
                        isAudioService={isAudioService}
                        downloadSubs={downloadSubs}
                        onDownloadSubsChange={setDownloadSubs}
                        subLang={subLang}
                        onSubLangChange={setSubLang}
                      />

                      <DownloadButton
                        onDownload={handleDownload}
                        defaultPath={settings?.defaultOutputPath || ""}
                        disabled={!videoInfo}
                      />
                    </div>
                  )}

                  {playlistInfo && (
                    <div className="space-y-6 animate-slide-up">
                      <PlaylistPreview
                        playlist={playlistInfo}
                        onDownloadSelected={handlePlaylistDownload}
                        isDownloading={isLoading}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Convert Tab */}
        {activeTab === "convert" && (
          <div className="h-full animate-fade-in">
            <ConvertPage initialAction={initialAction} />
          </div>
        )}

        {/* Queue Tab */}
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

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="h-full p-8 overflow-y-auto animate-fade-in">
            {settings ? (
              <Settings settings={settings} onSettingsChange={handleSettingsChange} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* About Tab */}
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
