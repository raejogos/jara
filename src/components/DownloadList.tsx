import type { DownloadItem } from "../types";

interface DownloadListProps {
  downloads: DownloadItem[];
  onCancel: (downloadId: string) => void;
  onRemove: (downloadId: string) => void;
  onClearCompleted: () => void;
  onDownloadFile?: (downloadId: string) => void;
}

export function DownloadList({ downloads, onCancel, onRemove, onClearCompleted, onDownloadFile }: DownloadListProps) {
  const hasCompletedOrFailed = downloads.some(
    (d) => d.status === "completed" || d.status === "error" || d.status === "cancelled"
  );

  if (downloads.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-600">
        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        <p className="text-lg font-medium text-gray-500">Nenhum download na fila</p>
        <p className="text-sm mt-1">Seus downloads aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-200">
          Fila de Downloads ({downloads.length})
        </h2>
        {hasCompletedOrFailed && (
          <button
            onClick={onClearCompleted}
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            Limpar finalizados
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {downloads.map((download, index) => (
          <DownloadItemCard
            key={download.id}
            download={download}
            onCancel={onCancel}
            onRemove={onRemove}
            onDownloadFile={onDownloadFile}
            style={{ animationDelay: `${index * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

interface DownloadItemCardProps {
  download: DownloadItem;
  onCancel: (downloadId: string) => void;
  onRemove: (downloadId: string) => void;
  onDownloadFile?: (downloadId: string) => void;
  style?: React.CSSProperties;
}

function DownloadItemCard({ download, onCancel, onRemove, onDownloadFile, style }: DownloadItemCardProps) {
  const statusColors = {
    pending: "text-gray-400",
    downloading: "text-white",
    processing: "text-gray-300",
    completed: "text-white",
    error: "text-gray-500",
    cancelled: "text-gray-600",
  };

  const statusLabels = {
    pending: "Aguardando",
    downloading: "Baixando",
    processing: "Processando",
    completed: "Concluído",
    error: "Erro",
    cancelled: "Cancelado",
  };

  const isActive = download.status === "downloading" || download.status === "processing";
  const isDone = download.status === "completed" || download.status === "error" || download.status === "cancelled";

  return (
    <div
      className="glass rounded-xl p-4 animate-slide-up"
      style={style}
    >
      <div className="flex gap-4">
        <div className="flex-shrink-0 w-24 aspect-video rounded-lg overflow-hidden bg-dark-800">
          {download.thumbnail ? (
            <img
              src={download.thumbnail}
              alt={download.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white truncate mb-1">{download.title}</h3>

          <div className="flex items-center gap-3 text-sm">
            <span className={statusColors[download.status]}>
              {statusLabels[download.status]}
            </span>

            {download.status === "downloading" && (
              <>
                {download.speed && <span className="text-gray-500">{download.speed}</span>}
                {download.eta && <span className="text-gray-500">ETA: {download.eta}</span>}
              </>
            )}

            {download.audio_only && (
              <span className="px-2 py-0.5 text-xs bg-dark-700 text-gray-400 rounded border border-dark-600">
                MP3
              </span>
            )}
          </div>

          {isActive && (
            <div className="mt-3">
              <div className="h-1 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{ width: `${download.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">{download.progress.toFixed(1)}%</p>
            </div>
          )}

          {download.status === "error" && download.error && (
            <p className="mt-2 text-xs text-gray-500">{download.error}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Download button for completed (web only) */}
          {download.status === "completed" && onDownloadFile && (
            <button
              onClick={() => onDownloadFile(download.id)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Baixar arquivo"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>
          )}

          {isActive && (
            <button
              onClick={() => onCancel(download.id)}
              className="p-2 text-gray-500 hover:text-white transition-colors"
              title="Cancelar download"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}

          {isDone && (
            <button
              onClick={() => onRemove(download.id)}
              className="p-2 text-gray-500 hover:text-white transition-colors"
              title="Remover da lista"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
