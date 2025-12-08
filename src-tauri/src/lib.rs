mod commands;
mod document_convert;
mod ffmpeg;
mod image_convert;
mod ytdlp;

use commands::{
    cancel_download, convert_document, convert_file, convert_image, get_video_info,
    select_directory, start_download,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_video_info,
            start_download,
            cancel_download,
            select_directory,
            convert_file,
            convert_image,
            convert_document
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
