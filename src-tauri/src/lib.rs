mod commands;
mod document_convert;
mod ffmpeg;
mod image_convert;
mod ytdlp;

use commands::{
    cancel_download, convert_document, convert_file, convert_image, get_playlist_info,
    get_video_info, is_playlist, select_directory, start_download, send_notification,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_video_info,
            get_playlist_info,
            is_playlist,
            start_download,
            cancel_download,
            select_directory,
            convert_file,
            convert_image,
            convert_document,
            send_notification
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
