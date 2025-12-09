use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub thumbnail: Option<String>,
    pub duration: Option<f64>,
    pub duration_string: Option<String>,
    pub uploader: Option<String>,
    pub view_count: Option<u64>,
    pub formats: Vec<VideoFormat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoFormat {
    pub format_id: String,
    pub format_note: Option<String>,
    pub ext: String,
    pub resolution: Option<String>,
    pub filesize: Option<u64>,
    pub filesize_approx: Option<u64>,
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
    pub quality: Option<f64>,
    pub fps: Option<f64>,
    pub tbr: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub download_id: String,
    pub status: String,
    pub progress: f64,
    pub speed: Option<String>,
    pub eta: Option<String>,
    pub filename: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistEntry {
    pub id: String,
    pub title: String,
    pub url: String,
    pub duration: Option<f64>,
    pub duration_string: Option<String>,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistInfo {
    pub id: String,
    pub title: String,
    pub uploader: Option<String>,
    pub entries: Vec<PlaylistEntry>,
    pub entry_count: usize,
}

pub struct YtDlp {
    exe_path: PathBuf,
    active_downloads: Arc<Mutex<HashMap<String, tokio::process::Child>>>,
}

impl YtDlp {
    pub fn new() -> Self {
        let exe_path = Self::find_ytdlp_path();
        Self {
            exe_path,
            active_downloads: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn find_ytdlp_path() -> PathBuf {
        // First try to find bundled yt-dlp in resources
        if let Ok(exe_path) = std::env::current_exe() {
            let resources_path = exe_path
                .parent()
                .map(|p| p.join("yt-dlp.exe"))
                .unwrap_or_default();
            if resources_path.exists() {
                return resources_path;
            }
        }

        // Fallback to system PATH
        PathBuf::from("yt-dlp")
    }

    // Check if URL is a playlist
    pub async fn is_playlist(&self, url: &str) -> bool {
        url.contains("playlist") || url.contains("list=")
    }

    pub async fn get_playlist_info(&self, url: &str) -> Result<PlaylistInfo, String> {
        let output = Command::new(&self.exe_path)
            .args([
                "--flat-playlist",
                "--dump-json",
                "--no-warnings",
                "--no-check-certificates",
                url
            ])
            .output()
            .await
            .map_err(|e| format!("Falha ao executar yt-dlp: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("yt-dlp error: {}", stderr));
        }

        let json_str = String::from_utf8_lossy(&output.stdout);
        let raw: serde_json::Value =
            serde_json::from_str(&json_str).map_err(|e| format!("Falha ao parsear JSON: {}", e))?;

        let entries: Vec<PlaylistEntry> = raw["entries"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|e| {
                        Some(PlaylistEntry {
                            id: e["id"].as_str().unwrap_or("").to_string(),
                            title: e["title"].as_str().unwrap_or("Sem título").to_string(),
                            url: e["url"].as_str().or(e["webpage_url"].as_str()).unwrap_or("").to_string(),
                            duration: e["duration"].as_f64(),
                            duration_string: e["duration_string"].as_str().map(String::from),
                            thumbnail: e["thumbnail"].as_str().map(String::from),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        let entry_count = entries.len();

        Ok(PlaylistInfo {
            id: raw["id"].as_str().unwrap_or("").to_string(),
            title: raw["title"].as_str().unwrap_or("Playlist").to_string(),
            uploader: raw["uploader"].as_str().map(String::from),
            entries,
            entry_count,
        })
    }

    pub async fn get_video_info(&self, url: &str) -> Result<VideoInfo, String> {
        let output = Command::new(&self.exe_path)
            .args([
                "--dump-json",
                "--no-playlist",
                "--no-warnings",
                "--no-check-certificates",
                "--prefer-free-formats",
                "--socket-timeout", "10",
                url
            ])
            .output()
            .await
            .map_err(|e| format!("Falha ao executar yt-dlp: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("yt-dlp error: {}", stderr));
        }

        let json_str = String::from_utf8_lossy(&output.stdout);
        let raw: serde_json::Value =
            serde_json::from_str(&json_str).map_err(|e| format!("Falha ao parsear JSON: {}", e))?;

        let formats = raw["formats"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|f| {
                        Some(VideoFormat {
                            format_id: f["format_id"].as_str()?.to_string(),
                            format_note: f["format_note"].as_str().map(String::from),
                            ext: f["ext"].as_str().unwrap_or("mp4").to_string(),
                            resolution: f["resolution"].as_str().map(String::from),
                            filesize: f["filesize"].as_u64(),
                            filesize_approx: f["filesize_approx"].as_u64(),
                            vcodec: f["vcodec"].as_str().map(String::from),
                            acodec: f["acodec"].as_str().map(String::from),
                            quality: f["quality"].as_f64(),
                            fps: f["fps"].as_f64(),
                            tbr: f["tbr"].as_f64(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(VideoInfo {
            id: raw["id"].as_str().unwrap_or("").to_string(),
            title: raw["title"].as_str().unwrap_or("Sem título").to_string(),
            thumbnail: raw["thumbnail"].as_str().map(String::from),
            duration: raw["duration"].as_f64(),
            duration_string: raw["duration_string"].as_str().map(String::from),
            uploader: raw["uploader"].as_str().map(String::from),
            view_count: raw["view_count"].as_u64(),
            formats,
        })
    }

    pub async fn start_download<F>(
        &self,
        download_id: String,
        url: &str,
        format_id: Option<&str>,
        output_path: &str,
        audio_only: bool,
        download_subs: bool,
        sub_lang: Option<&str>,
        on_progress: F,
    ) -> Result<(), String>
    where
        F: Fn(DownloadProgress) + Send + Sync + 'static,
    {
        let mut args = vec![
            "--newline".to_string(),
            "--progress".to_string(),
            "-o".to_string(),
            format!("{}/%(title)s.%(ext)s", output_path),
        ];

        if audio_only {
            args.push("-x".to_string());
            args.push("--audio-format".to_string());
            args.push("mp3".to_string());
            args.push("--audio-quality".to_string());
            args.push("0".to_string());
        } else if let Some(fmt) = format_id {
            args.push("-f".to_string());
            args.push(fmt.to_string());
        }

        // Subtitle options
        if download_subs {
            args.push("--write-subs".to_string());
            args.push("--embed-subs".to_string());
            if let Some(lang) = sub_lang {
                args.push("--sub-lang".to_string());
                args.push(lang.to_string());
            } else {
                args.push("--sub-lang".to_string());
                args.push("pt,en".to_string());
            }
        }

        args.push(url.to_string());

        let mut child = Command::new(&self.exe_path)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Falha ao iniciar download: {}", e))?;

        let stdout = child.stdout.take().ok_or("Falha ao capturar stdout")?;
        let stderr = child.stderr.take().ok_or("Falha ao capturar stderr")?;

        // Store child process for potential cancellation
        {
            let mut downloads = self.active_downloads.lock().await;
            downloads.insert(download_id.clone(), child);
        }

        let progress_regex =
            Regex::new(r"\[download\]\s+(\d+\.?\d*)%\s+of.*?at\s+(\S+)\s+ETA\s+(\S+)").unwrap();
        let dest_regex = Regex::new(r"\[download\] Destination: (.+)").unwrap();
        let merge_regex = Regex::new(r"\[Merger\] Merging formats into").unwrap();
        let extract_regex = Regex::new(r"\[ExtractAudio\]").unwrap();

        let download_id_clone = download_id.clone();
        let on_progress = Arc::new(on_progress);
        let on_progress_clone = on_progress.clone();

        // Read stdout
        let stdout_handle = tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            let mut current_filename: Option<String> = None;

            while let Ok(Some(line)) = lines.next_line().await {
                if let Some(caps) = progress_regex.captures(&line) {
                    let progress: f64 = caps[1].parse().unwrap_or(0.0);
                    let speed = caps.get(2).map(|m| m.as_str().to_string());
                    let eta = caps.get(3).map(|m| m.as_str().to_string());

                    on_progress_clone(DownloadProgress {
                        download_id: download_id_clone.clone(),
                        status: "downloading".to_string(),
                        progress,
                        speed,
                        eta,
                        filename: current_filename.clone(),
                    });
                } else if let Some(caps) = dest_regex.captures(&line) {
                    current_filename = Some(caps[1].to_string());
                } else if merge_regex.is_match(&line) || extract_regex.is_match(&line) {
                    on_progress_clone(DownloadProgress {
                        download_id: download_id_clone.clone(),
                        status: "processing".to_string(),
                        progress: 100.0,
                        speed: None,
                        eta: None,
                        filename: current_filename.clone(),
                    });
                }
            }
        });

        // Read stderr for errors
        let stderr_handle = tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            let mut error_output = String::new();

            while let Ok(Some(line)) = lines.next_line().await {
                if line.contains("ERROR") {
                    error_output.push_str(&line);
                    error_output.push('\n');
                }
            }
            error_output
        });

        // Wait for completion
        let _ = stdout_handle.await;
        let error_output = stderr_handle.await.unwrap_or_default();

        // Remove from active downloads
        let status = {
            let mut downloads = self.active_downloads.lock().await;
            if let Some(mut child) = downloads.remove(&download_id) {
                child.wait().await
            } else {
                return Err("Download cancelado".to_string());
            }
        };

        match status {
            Ok(exit_status) if exit_status.success() => {
                on_progress(DownloadProgress {
                    download_id,
                    status: "completed".to_string(),
                    progress: 100.0,
                    speed: None,
                    eta: None,
                    filename: None,
                });
                Ok(())
            }
            Ok(_) => Err(format!("Download falhou: {}", error_output)),
            Err(e) => Err(format!("Erro ao aguardar processo: {}", e)),
        }
    }

    pub async fn cancel_download(&self, download_id: &str) -> Result<(), String> {
        let mut downloads = self.active_downloads.lock().await;
        if let Some(mut child) = downloads.remove(download_id) {
            child
                .kill()
                .await
                .map_err(|e| format!("Falha ao cancelar: {}", e))?;
            Ok(())
        } else {
            Err("Download não encontrado".to_string())
        }
    }
}

impl Default for YtDlp {
    fn default() -> Self {
        Self::new()
    }
}

