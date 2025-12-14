import { useState, useEffect, useCallback, useRef } from "react";
import { getVideoInfo as fetchVideoInfo, getPlaylistInfo as fetchPlaylistInfo, isPlaylist as checkIsPlaylist, startDownload as apiStartDownload, cancelDownload as apiCancelDownload, sendNotification, platform } from "../services/api";
import type { VideoInfo, PlaylistInfo, DownloadItem, DownloadProgress } from "../types";

export function useDownload() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const lastUrlRef = useRef<string>("");
  const completedIdsRef = useRef<Set<string>>(new Set());

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

  // Send notifications when downloads complete
  useEffect(() => {
    if (!notificationsEnabled) return;

    downloads.forEach((download) => {
      if (download.status === "completed" && !completedIdsRef.current.has(download.id)) {
        completedIdsRef.current.add(download.id);
        sendNotification(
          "Download concluído",
          `${download.title} foi baixado com sucesso.`
        ).catch(() => {
          // Ignore notification errors
        });
      }
    });
  }, [downloads, notificationsEnabled]);

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

  const getPlaylistInfo = useCallback(async (url: string): Promise<PlaylistInfo> => {
    setIsLoading(true);
    setError(null);
    lastUrlRef.current = url;

    try {
      const info = await fetchPlaylistInfo(url);
      return info;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const isPlaylist = useCallback(async (url: string): Promise<boolean> => {
    return checkIsPlaylist(url);
  }, []);

  const startDownload = useCallback(
    async (
      videoInfo: VideoInfo,
      formatId: string | null,
      outputPath: string,
      audioOnly: boolean,
      downloadSubs: boolean = false,
      subLang?: string
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

        const serverDownloadId = await apiStartDownload(
          url,
          formatId,
          outputPath,
          audioOnly,
          (progress) => {
            setDownloads((prev) =>
              prev.map((item) =>
                item.id === serverDownloadId
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
          },
          downloadSubs,
          subLang
        );

        // Update the download item with the server's ID
        setDownloads((prev) =>
          prev.map((item) =>
            item.id === downloadId ? { ...item, id: serverDownloadId } : item
          )
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

  // Batch download - adds multiple URLs to the queue
  const startBatchDownload = useCallback(
    async (urls: string[], outputPath: string, audioOnly: boolean) => {
      for (const url of urls) {
        const downloadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Add to queue with placeholder info
        const newDownload: DownloadItem = {
          id: downloadId,
          url,
          title: "Carregando...",
          thumbnail: null,
          format_id: null,
          audio_only: audioOnly,
          output_path: outputPath,
          progress: 0,
          speed: null,
          eta: null,
          status: "pending",
        };

        setDownloads((prev) => [newDownload, ...prev]);

        // Fetch info and start download in background
        (async () => {
          try {
            // Get video info
            const info = await fetchVideoInfo(url);

            // Update with real info
            setDownloads((prev) =>
              prev.map((item) =>
                item.id === downloadId
                  ? { ...item, title: info.title, thumbnail: info.thumbnail, status: "downloading" }
                  : item
              )
            );

            // Start download
            const serverDownloadId = await apiStartDownload(
              url,
              null, // Best quality
              outputPath,
              audioOnly,
              (progress) => {
                setDownloads((prev) =>
                  prev.map((item) =>
                    item.id === serverDownloadId
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

            // Update the download item with the server's ID
            setDownloads((prev) =>
              prev.map((item) =>
                item.id === downloadId ? { ...item, id: serverDownloadId } : item
              )
            );
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            setDownloads((prev) =>
              prev.map((item) =>
                item.id === downloadId
                  ? { ...item, title: url, status: "error", error: errorMsg }
                  : item
              )
            );
          }
        })();

        // Small delay between starting each download to avoid overwhelming
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    },
    []
  );

  return {
    downloads,
    isLoading,
    error,
    notificationsEnabled,
    setNotificationsEnabled,
    getVideoInfo,
    getPlaylistInfo,
    isPlaylist,
    startDownload,
    startBatchDownload,
    cancelDownload,
    removeDownload,
    clearCompleted,
  };
}
