import { useState, useMemo } from "react";
import type { PlaylistInfo } from "../types";

interface PlaylistPreviewProps {
  playlist: PlaylistInfo;
  onDownloadSelected: (selectedUrls: string[]) => void;
  isDownloading: boolean;
}

export function PlaylistPreview({ playlist, onDownloadSelected, isDownloading }: PlaylistPreviewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(playlist.entries.map((e) => e.id))
  );

  const allSelected = selectedIds.size === playlist.entries.length;
  const noneSelected = selectedIds.size === 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(playlist.entries.map((e) => e.id)));
    }
  };

  const toggleEntry = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDownload = () => {
    const selectedUrls = playlist.entries
      .filter((e) => selectedIds.has(e.id))
      .map((e) => e.url);
    onDownloadSelected(selectedUrls);
  };

  // Calculate total duration of selected
  const totalDuration = useMemo(() => {
    const total = playlist.entries
      .filter((e) => selectedIds.has(e.id))
      .reduce((acc, e) => acc + (e.duration || 0), 0);
    
    if (total === 0) return null;
    
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  }, [playlist.entries, selectedIds]);

  return (
    <div className="glass rounded-xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white truncate">{playlist.title}</h3>
          <span className="text-xs text-gray-500 font-mono">
            {playlist.entry_count} vídeos
          </span>
        </div>
        {playlist.uploader && (
          <p className="text-sm text-gray-400">{playlist.uploader}</p>
        )}
      </div>

      {/* Select all / none */}
      <div className="px-4 py-3 bg-dark-800 border-b border-dark-700 flex items-center justify-between">
        <button
          onClick={toggleAll}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          {allSelected ? "desmarcar todos" : "selecionar todos"}
        </button>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{selectedIds.size} selecionados</span>
          {totalDuration && <span>{totalDuration}</span>}
        </div>
      </div>

      {/* Entry list */}
      <div className="max-h-64 overflow-y-auto">
        {playlist.entries.map((entry, index) => (
          <div
            key={entry.id}
            onClick={() => toggleEntry(entry.id)}
            className={`flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-dark-800 ${
              selectedIds.has(entry.id)
                ? "bg-dark-800"
                : "bg-dark-900 hover:bg-dark-850"
            }`}
          >
            {/* Checkbox */}
            <div
              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                selectedIds.has(entry.id)
                  ? "bg-white border-white"
                  : "border-dark-600"
              }`}
            >
              {selectedIds.has(entry.id) && (
                <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>

            {/* Index */}
            <span className="w-6 text-xs text-gray-600 font-mono text-right">
              {index + 1}
            </span>

            {/* Thumbnail */}
            {entry.thumbnail && (
              <div className="w-16 h-9 rounded overflow-hidden bg-dark-700 flex-shrink-0">
                <img
                  src={entry.thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}

            {/* Title & Duration */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{entry.title}</p>
            </div>
            {entry.duration_string && (
              <span className="text-xs text-gray-500 font-mono">
                {entry.duration_string}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Download button */}
      <div className="p-4">
        <button
          onClick={handleDownload}
          disabled={noneSelected || isDownloading}
          className="w-full py-3 bg-white text-black rounded-xl font-semibold hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {isDownloading
            ? "adicionando à fila..."
            : `baixar ${selectedIds.size} vídeo${selectedIds.size !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}

