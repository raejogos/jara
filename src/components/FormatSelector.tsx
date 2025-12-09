import { useMemo } from "react";
import type { VideoFormat } from "../types";

interface FormatSelectorProps {
  formats: VideoFormat[];
  selectedFormat: VideoFormat | null;
  onSelectFormat: (format: VideoFormat | null) => void;
  audioOnly: boolean;
  onAudioOnlyChange: (audioOnly: boolean) => void;
  downloadSubs?: boolean;
  onDownloadSubsChange?: (downloadSubs: boolean) => void;
  subLang?: string;
  onSubLangChange?: (lang: string) => void;
}

export function FormatSelector({
  formats,
  selectedFormat,
  onSelectFormat,
  audioOnly,
  onAudioOnlyChange,
  downloadSubs = false,
  onDownloadSubsChange,
  subLang = "pt,en",
  onSubLangChange,
}: FormatSelectorProps) {
  // Filter and organize formats
  const { videoFormats, audioFormats } = useMemo(() => {
    const video: VideoFormat[] = [];
    const audio: VideoFormat[] = [];

    formats.forEach((format) => {
      const hasVideo = format.vcodec && format.vcodec !== "none";
      const hasAudio = format.acodec && format.acodec !== "none";

      if (hasVideo) {
        video.push(format);
      } else if (hasAudio) {
        audio.push(format);
      }
    });

    // Sort video formats by quality (resolution)
    video.sort((a, b) => {
      const getHeight = (res: string | null) => {
        if (!res) return 0;
        const match = res.match(/(\d+)p/);
        return match ? parseInt(match[1]) : 0;
      };
      return getHeight(b.resolution) - getHeight(a.resolution);
    });

    // Sort audio formats by bitrate
    audio.sort((a, b) => (b.tbr || 0) - (a.tbr || 0));

    return { videoFormats: video, audioFormats: audio };
  }, [formats]);

  // Get unique resolutions for video
  const uniqueVideoFormats = useMemo(() => {
    const seen = new Set<string>();
    return videoFormats.filter((format) => {
      const key = format.resolution || format.format_id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [videoFormats]);

  const formatFileSize = (size: number | null | undefined) => {
    if (!size) return null;
    if (size >= 1_000_000_000) {
      return `${(size / 1_000_000_000).toFixed(1)} GB`;
    }
    if (size >= 1_000_000) {
      return `${(size / 1_000_000).toFixed(1)} MB`;
    }
    return `${(size / 1_000).toFixed(1)} KB`;
  };

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-200">Formato de Download</h3>

        {/* Audio only toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <span className="text-sm text-gray-500">Apenas áudio (MP3)</span>
          <div
            className={`relative w-12 h-6 rounded-full transition-colors ${
              audioOnly ? "bg-white" : "bg-dark-600"
            }`}
            onClick={() => onAudioOnlyChange(!audioOnly)}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${
                audioOnly ? "translate-x-7 bg-black" : "translate-x-1 bg-gray-400"
              }`}
            />
          </div>
        </label>
      </div>

      {audioOnly ? (
        <div className="p-4 bg-dark-800 border border-dark-700 rounded-lg">
          <div className="flex items-center gap-3 text-gray-400">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <div>
              <p className="font-medium text-white">Extração de áudio habilitada</p>
              <p className="text-sm text-gray-500">O vídeo será convertido para MP3 com qualidade máxima</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Best quality option */}
          <button
            onClick={() => onSelectFormat(null)}
            className={`p-4 rounded-lg border transition-all ${
              selectedFormat === null
                ? "border-white bg-white text-black"
                : "border-dark-600 bg-dark-800 text-gray-400 hover:border-dark-500"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
              <span className="font-medium">Melhor</span>
            </div>
            <p className={`text-xs ${selectedFormat === null ? "text-black/60" : "text-gray-600"}`}>Qualidade automática</p>
          </button>

          {/* Video format options */}
          {uniqueVideoFormats.slice(0, 7).map((format) => (
            <button
              key={format.format_id}
              onClick={() => onSelectFormat(format)}
              className={`p-4 rounded-lg border transition-all ${
                selectedFormat?.format_id === format.format_id
                  ? "border-white bg-white text-black"
                  : "border-dark-600 bg-dark-800 text-gray-400 hover:border-dark-500"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">{format.resolution || format.format_note}</span>
                {format.fps && format.fps >= 60 && (
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    selectedFormat?.format_id === format.format_id
                      ? "bg-black/20 text-black"
                      : "bg-dark-600 text-gray-400"
                  }`}>
                    {format.fps}fps
                  </span>
                )}
              </div>
              <p className={`text-xs ${selectedFormat?.format_id === format.format_id ? "text-black/60" : "text-gray-600"}`}>
                {format.ext.toUpperCase()}
                {formatFileSize(format.filesize || format.filesize_approx) && (
                  <> · {formatFileSize(format.filesize || format.filesize_approx)}</>
                )}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Audio formats info */}
      {!audioOnly && audioFormats.length > 0 && (
        <p className="mt-4 text-xs text-gray-600">
          O áudio será mesclado automaticamente com o vídeo selecionado.
        </p>
      )}

      {/* Subtitles section */}
      {onDownloadSubsChange && !audioOnly && (
        <div className="mt-6 pt-6 border-t border-dark-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span className="text-sm text-gray-400">Baixar legendas</span>
            </div>

            <div className="flex items-center gap-3">
              {downloadSubs && onSubLangChange && (
                <select
                  value={subLang}
                  onChange={(e) => onSubLangChange(e.target.value)}
                  className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:border-dark-400"
                >
                  <option value="pt,en">Português, Inglês</option>
                  <option value="pt">Português</option>
                  <option value="en">Inglês</option>
                  <option value="es">Espanhol</option>
                  <option value="all">Todas disponíveis</option>
                </select>
              )}

              <div
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                  downloadSubs ? "bg-white" : "bg-dark-600"
                }`}
                onClick={() => onDownloadSubsChange(!downloadSubs)}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${
                    downloadSubs ? "translate-x-7 bg-black" : "translate-x-1 bg-gray-400"
                  }`}
                />
              </div>
            </div>
          </div>
          {downloadSubs && (
            <p className="mt-2 text-xs text-gray-600">
              As legendas serão embutidas no vídeo quando disponíveis.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
