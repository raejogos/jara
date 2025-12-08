#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod document_convert;
mod ffmpeg;
mod image_convert;
mod ytdlp;

fn main() {
    jara_lib::run()
}
