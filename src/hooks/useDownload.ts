import { useState, useEffect, useCallback, useRef } from "react";
import { getVideoInfo as fetchVideoInfo, startDownload as apiStartDownload, cancelDownload as apiCancelDownload, platform } from "../services/api";
import type { VideoInfo, DownloadItem, DownloadProgress } from "../types";

export function useDownload() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastUrlRef = useRef<string>("");

  // Listen for download progress events (Tauri only - web uses polling in api.ts)
  useEffect(() => {
    if (!platform.isTauri) return;

    let unlisten: (() => void) | null = null;
    
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<DownloadProgress>("download-progress", (event) => {
        const progress = event.payload;
        setDownloads((prev) =>
          prev.map((item) =>
            item.id === progress.download_id
              ? {
                  ...item,
                  progress: progress.progress,
                  speed: progress.speed,
                  eta: progress.eta,
                  status: progress.status as DownloadItem["status"],
                }
              : item
          )
        );
      });
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const getVideoInfo = useCallback(async (url: string): Promise<VideoInfo> => {
    setIsLoading(true);
    setError(null);
    lastUrlRef.current = url;

    try {
      const info = await fetchVideoInfo(url);
      return info;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startDownload = useCallback(
    async (
      videoInfo: VideoInfo,
      formatId: string | null,
      outputPath: string,
      audioOnly: boolean
    ) => {
      const downloadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const url = lastUrlRef.current;

      const newDownload: DownloadItem = {
        id: downloadId,
        url,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        format_id: formatId,
        audio_only: audioOnly,
        output_path: outputPath,
        progress: 0,
        speed: null,
        eta: null,
        status: "pending",
      };

      setDownloads((prev) => [newDownload, ...prev]);

      try {
        setDownloads((prev) =>
          prev.map((item) =>
            item.id === downloadId ? { ...item, status: "downloading" } : item
          )
        );

        await apiStartDownload(
          url,
          formatId,
          outputPath,
          audioOnly,
          (progress) => {
            setDownloads((prev) =>
              prev.map((item) =>
                item.id === progress.download_id
                  ? {
                      ...item,
                      progress: progress.progress,
                      speed: progress.speed,
                      eta: progress.eta,
                      status: progress.status as DownloadItem["status"],
                    }
                  : item
              )
            );
          }
        );
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setDownloads((prev) =>
          prev.map((item) =>
            item.id === downloadId
              ? { ...item, status: "error", error: errorMsg }
              : item
          )
        );
      }
    },
    []
  );

  const cancelDownload = useCallback(async (downloadId: string) => {
    try {
      await apiCancelDownload(downloadId);
      setDownloads((prev) =>
        prev.map((item) =>
          item.id === downloadId ? { ...item, status: "cancelled" } : item
        )
      );
    } catch (e) {
      console.error("Failed to cancel download:", e);
    }
  }, []);

  const removeDownload = useCallback((downloadId: string) => {
    setDownloads((prev) => prev.filter((item) => item.id !== downloadId));
  }, []);

  const clearCompleted = useCallback(() => {
    setDownloads((prev) =>
      prev.filter(
        (item) =>
          item.status !== "completed" &&
          item.status !== "error" &&
          item.status !== "cancelled"
      )
    );
  }, []);

  return {
    downloads,
    isLoading,
    error,
    getVideoInfo,
    startDownload,
    cancelDownload,
    removeDownload,
    clearCompleted,
  };
}
