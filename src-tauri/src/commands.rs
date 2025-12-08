use crate::document_convert::DocumentConverter;
use crate::ffmpeg::FFmpeg;
use crate::image_convert::ImageConverter;
use crate::ytdlp::{DownloadProgress, VideoInfo, YtDlp};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tauri::{Emitter, Window};

static YTDLP: OnceLock<YtDlp> = OnceLock::new();
static FFMPEG: OnceLock<FFmpeg> = OnceLock::new();
static IMAGE_CONVERTER: OnceLock<ImageConverter> = OnceLock::new();
static DOCUMENT_CONVERTER: OnceLock<DocumentConverter> = OnceLock::new();

fn get_ytdlp() -> &'static YtDlp {
    YTDLP.get_or_init(YtDlp::new)
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
}

#[tauri::command]
pub async fn get_video_info(url: String) -> Result<VideoInfo, String> {
    get_ytdlp().get_video_info(&url).await
}

#[tauri::command]
pub async fn start_download(
    window: Window,
    download_id: String,
    request: DownloadRequest,
) -> Result<(), String> {
    let ytdlp = get_ytdlp();

    ytdlp
        .start_download(
            download_id,
            &request.url,
            request.format_id.as_deref(),
            &request.output_path,
            request.audio_only,
            move |progress: DownloadProgress| {
                let _ = window.emit("download-progress", &progress);
            },
        )
        .await
}

#[tauri::command]
pub async fn cancel_download(download_id: String) -> Result<(), String> {
    get_ytdlp().cancel_download(&download_id).await
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
