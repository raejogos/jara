import type { VideoInfo } from "../types";

interface VideoPreviewProps {
  videoInfo: VideoInfo;
}

export function VideoPreview({ videoInfo }: VideoPreviewProps) {
  const formatViewCount = (count: number | null) => {
    if (!count) return null;
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M visualizações`;
    }
    if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}K visualizações`;
    }
    return `${count} visualizações`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex gap-6">
        {/* Thumbnail */}
        <div className="relative flex-shrink-0 w-64 aspect-video rounded-lg overflow-hidden bg-dark-800">
          {videoInfo.thumbnail ? (
            <img
              src={videoInfo.thumbnail}
              alt={videoInfo.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-gray-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}

          {/* Duration badge */}
          {videoInfo.duration && (
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/90 rounded text-xs font-mono text-white">
              {formatDuration(videoInfo.duration)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-white line-clamp-2 mb-2">
            {videoInfo.title}
          </h2>

          {videoInfo.uploader && (
            <p className="text-gray-500 text-sm mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              {videoInfo.uploader}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {videoInfo.view_count && (
              <span className="px-3 py-1 bg-dark-800 border border-dark-700 rounded-full text-xs text-gray-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                {formatViewCount(videoInfo.view_count)}
              </span>
            )}

            {videoInfo.duration_string && (
              <span className="px-3 py-1 bg-dark-800 border border-dark-700 rounded-full text-xs text-gray-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {videoInfo.duration_string}
              </span>
            )}

            <span className="px-3 py-1 bg-dark-800 border border-dark-700 rounded-full text-xs text-gray-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                />
              </svg>
              {videoInfo.formats.length} formatos
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
