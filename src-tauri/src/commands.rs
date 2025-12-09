use crate::document_convert::DocumentConverter;
use crate::ffmpeg::FFmpeg;
use crate::image_convert::ImageConverter;
use crate::ytdlp::{DownloadProgress, PlaylistInfo, VideoInfo, YtDlp};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tauri::{Emitter, Window};

use tokio::sync::Mutex as TokioMutex;

static YTDLP: OnceLock<TokioMutex<YtDlp>> = OnceLock::new();
static FFMPEG: OnceLock<FFmpeg> = OnceLock::new();
static IMAGE_CONVERTER: OnceLock<ImageConverter> = OnceLock::new();
static DOCUMENT_CONVERTER: OnceLock<DocumentConverter> = OnceLock::new();

fn get_ytdlp() -> &'static TokioMutex<YtDlp> {
    YTDLP.get_or_init(|| TokioMutex::new(YtDlp::new()))
}

fn get_ffmpeg() -> &'static FFmpeg {
    FFMPEG.get_or_init(FFmpeg::new)
}

fn get_image_converter() -> &'static ImageConverter {
    IMAGE_CONVERTER.get_or_init(ImageConverter::new)
}

fn get_document_converter() -> &'static DocumentConverter {
    DOCUMENT_CONVERTER.get_or_init(DocumentConverter::new)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadRequest {
    pub url: String,
    pub format_id: Option<String>,
    pub output_path: String,
    pub audio_only: bool,
    #[serde(default)]
    pub download_subs: bool,
    pub sub_lang: Option<String>,
}

#[tauri::command]
pub async fn get_video_info(url: String) -> Result<VideoInfo, String> {
    let mut ytdlp = get_ytdlp().lock().await;
    ytdlp.ensure_ytdlp_exists().await?;
    ytdlp.get_video_info(&url).await
}

#[tauri::command]
pub async fn get_playlist_info(url: String) -> Result<PlaylistInfo, String> {
    let mut ytdlp = get_ytdlp().lock().await;
    ytdlp.ensure_ytdlp_exists().await?;
    ytdlp.get_playlist_info(&url).await
}

#[tauri::command]
pub async fn is_playlist(url: String) -> Result<bool, String> {
    let ytdlp = get_ytdlp().lock().await;
    Ok(ytdlp.is_playlist(&url).await)
}

#[tauri::command]
pub async fn start_download(
    window: Window,
    download_id: String,
    request: DownloadRequest,
) -> Result<(), String> {
    let mut ytdlp = get_ytdlp().lock().await;
    ytdlp.ensure_ytdlp_exists().await?;

    ytdlp
        .start_download(
            download_id,
            &request.url,
            request.format_id.as_deref(),
            &request.output_path,
            request.audio_only,
            request.download_subs,
            request.sub_lang.as_deref(),
            move |progress: DownloadProgress| {
                let _ = window.emit("download-progress", &progress);
            },
        )
        .await
}

#[tauri::command]
pub async fn cancel_download(download_id: String) -> Result<(), String> {
    let ytdlp = get_ytdlp().lock().await;
    ytdlp.cancel_download(&download_id).await
}

#[tauri::command]
pub async fn select_directory() -> Result<Option<String>, String> {
    Ok(None)
}

#[tauri::command]
pub async fn convert_file(input_path: String, output_format: String) -> Result<String, String> {
    get_ffmpeg().convert(&input_path, &output_format).await
}

#[tauri::command]
pub fn convert_image(input_path: String, output_format: String) -> Result<String, String> {
    get_image_converter().convert(&input_path, &output_format)
}

#[tauri::command]
pub fn convert_document(input_path: String, output_format: String) -> Result<String, String> {
    get_document_converter().convert(&input_path, &output_format)
}

#[tauri::command]
pub fn send_notification(app_handle: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    
    app_handle
        .notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| format!("Falha ao enviar notificação: {}", e))
}
