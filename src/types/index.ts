export interface VideoFormat {
  format_id: string;
  format_note: string | null;
  ext: string;
  resolution: string | null;
  filesize: number | null;
  filesize_approx: number | null;
  vcodec: string | null;
  acodec: string | null;
  quality: number | null;
  fps: number | null;
  tbr: number | null;
}

export interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string | null;
  duration: number | null;
  duration_string: string | null;
  uploader: string | null;
  view_count: number | null;
  formats: VideoFormat[];
}

export interface DownloadProgress {
  download_id: string;
  status: "downloading" | "processing" | "completed" | "error" | "cancelled";
  progress: number;
  speed: string | null;
  eta: string | null;
  filename: string | null;
}

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  thumbnail: string | null;
  format_id: string | null;
  audio_only: boolean;
  output_path: string;
  progress: number;
  speed: string | null;
  eta: string | null;
  status: "pending" | "downloading" | "processing" | "completed" | "error" | "cancelled";
  error?: string;
}

export interface DownloadRequest {
  url: string;
  format_id: string | null;
  output_path: string;
  audio_only: boolean;
}

export interface AppSettings {
  defaultOutputPath: string;
  preferredAudioFormat: string;
  preferredVideoQuality: string;
}

