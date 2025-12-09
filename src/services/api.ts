// API abstraction layer - works with both Tauri and Web
import type { VideoInfo, DownloadProgress, PlaylistInfo } from "../types";

const IS_TAURI = typeof window !== "undefined" && "__TAURI__" in window;
const API_BASE = import.meta.env.VITE_API_URL || "";

// Tauri imports (lazy loaded)
let invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let listen: ((event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>) | null = null;

async function loadTauri() {
  if (IS_TAURI && !invoke) {
    const core = await import("@tauri-apps/api/core");
    const event = await import("@tauri-apps/api/event");
    invoke = core.invoke;
    listen = event.listen;
  }
}

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  if (IS_TAURI) {
    await loadTauri();
    return invoke!("get_video_info", { url }) as Promise<VideoInfo>;
  } else {
    const response = await fetch(`${API_BASE}/api/video-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get video info");
    }
    return response.json();
  }
}

export async function isPlaylist(url: string): Promise<boolean> {
  if (IS_TAURI) {
    await loadTauri();
    return invoke!("is_playlist", { url }) as Promise<boolean>;
  } else {
    // Simple URL check for web
    return url.includes("playlist") || url.includes("list=");
  }
}

export async function getPlaylistInfo(url: string): Promise<PlaylistInfo> {
  if (IS_TAURI) {
    await loadTauri();
    return invoke!("get_playlist_info", { url }) as Promise<PlaylistInfo>;
  } else {
    const response = await fetch(`${API_BASE}/api/playlist-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get playlist info");
    }
    return response.json();
  }
}

export async function startDownload(
  url: string,
  formatId: string | null,
  outputPath: string,
  audioOnly: boolean,
  onProgress: (progress: DownloadProgress) => void,
  downloadSubs: boolean = false,
  subLang?: string
): Promise<string> {
  if (IS_TAURI) {
    await loadTauri();
    const downloadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Listen for progress events
    const unlisten = await listen!("download-progress", (event) => {
      onProgress(event.payload as DownloadProgress);
    });

    try {
      await invoke!("start_download", {
        downloadId,
        request: {
          url,
          format_id: formatId,
          output_path: outputPath,
          audio_only: audioOnly,
          download_subs: downloadSubs,
          sub_lang: subLang,
        },
      });
    } finally {
      unlisten();
    }
    
    return downloadId;
  } else {
    // Web version
    const response = await fetch(`${API_BASE}/api/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, format_id: formatId, audio_only: audioOnly }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to start download");
    }
    
    const { downloadId } = await response.json();
    
    // Poll for progress
    const pollProgress = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/download/${downloadId}/progress`);
        const data = await res.json();
        
        onProgress({
          download_id: downloadId,
          status: data.status,
          progress: data.progress,
          speed: null,
          eta: null,
          filename: data.filename,
        });
        
        if (data.status === "downloading" || data.status === "processing") {
          setTimeout(pollProgress, 1000);
        }
      } catch {
        // Ignore polling errors
      }
    };
    
    pollProgress();
    return downloadId;
  }
}

export async function cancelDownload(downloadId: string): Promise<void> {
  if (IS_TAURI) {
    await loadTauri();
    await invoke!("cancel_download", { downloadId });
  } else {
    await fetch(`${API_BASE}/api/download/${downloadId}`, { method: "DELETE" });
  }
}

export async function convertFile(
  inputPath: string,
  outputFormat: string,
  category: "media" | "image" | "document"
): Promise<string> {
  if (IS_TAURI) {
    await loadTauri();
    const command = category === "media" ? "convert_file" : 
                    category === "image" ? "convert_image" : "convert_document";
    return invoke!(command, { inputPath, outputFormat }) as Promise<string>;
  } else {
    throw new Error("File conversion on web requires file upload - coming soon");
  }
}

export async function selectDirectory(): Promise<string | null> {
  if (IS_TAURI) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
    });
    return selected as string | null;
  } else {
    // Web doesn't have directory picker in the same way
    return null;
  }
}

export async function selectFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null> {
  if (IS_TAURI) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters,
    });
    return selected as string | null;
  } else {
    // Web uses file input
    return null;
  }
}

export function getDownloadUrl(downloadId: string): string {
  return `${API_BASE}/api/download/${downloadId}/file`;
}

export const platform = {
  isTauri: IS_TAURI,
  isWeb: !IS_TAURI,
};

// Notifications
export async function sendNotification(title: string, body: string): Promise<void> {
  if (IS_TAURI) {
    await loadTauri();
    await invoke!("send_notification", { title, body });
  } else {
    // Web notification
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          new Notification(title, { body });
        }
      }
    }
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (IS_TAURI) {
    // Tauri notifications don't need explicit permission on most platforms
    return true;
  } else {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        return true;
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
      }
    }
    return false;
  }
}

