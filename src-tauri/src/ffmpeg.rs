use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::Command;

pub struct FFmpeg {
    exe_path: PathBuf,
}

impl FFmpeg {
    pub fn new() -> Self {
        let exe_path = Self::find_ffmpeg_path();
        Self { exe_path }
    }

    fn find_ffmpeg_path() -> PathBuf {
        // First try to find bundled ffmpeg in resources
        if let Ok(exe_path) = std::env::current_exe() {
            let resources_path = exe_path
                .parent()
                .map(|p| p.join("ffmpeg.exe"))
                .unwrap_or_default();
            if resources_path.exists() {
                return resources_path;
            }
        }

        // Fallback to system PATH
        PathBuf::from("ffmpeg")
    }

    pub async fn convert(
        &self,
        input_path: &str,
        output_format: &str,
    ) -> Result<String, String> {
        let input = PathBuf::from(input_path);
        
        if !input.exists() {
            return Err("Arquivo de entrada não encontrado".to_string());
        }

        // Generate output path
        let output = input.with_extension(output_format);
        let output_str = output.to_string_lossy().to_string();

        // Build ffmpeg arguments based on format
        let mut args = vec![
            "-i".to_string(),
            input_path.to_string(),
            "-y".to_string(), // Overwrite output
        ];

        // Add format-specific options
        match output_format {
            "mp3" => {
                args.extend([
                    "-vn".to_string(),           // No video
                    "-acodec".to_string(),
                    "libmp3lame".to_string(),
                    "-q:a".to_string(),
                    "0".to_string(),             // Best quality
                ]);
            }
            "m4a" | "aac" => {
                args.extend([
                    "-vn".to_string(),
                    "-acodec".to_string(),
                    "aac".to_string(),
                    "-b:a".to_string(),
                    "256k".to_string(),
                ]);
            }
            "wav" => {
                args.extend([
                    "-vn".to_string(),
                    "-acodec".to_string(),
                    "pcm_s16le".to_string(),
                ]);
            }
            "flac" => {
                args.extend([
                    "-vn".to_string(),
                    "-acodec".to_string(),
                    "flac".to_string(),
                ]);
            }
            "mp4" => {
                args.extend([
                    "-c:v".to_string(),
                    "libx264".to_string(),
                    "-c:a".to_string(),
                    "aac".to_string(),
                    "-preset".to_string(),
                    "fast".to_string(),
                ]);
            }
            "mkv" => {
                args.extend([
                    "-c:v".to_string(),
                    "copy".to_string(),
                    "-c:a".to_string(),
                    "copy".to_string(),
                ]);
            }
            "webm" => {
                args.extend([
                    "-c:v".to_string(),
                    "libvpx-vp9".to_string(),
                    "-c:a".to_string(),
                    "libopus".to_string(),
                    "-b:v".to_string(),
                    "2M".to_string(),
                ]);
            }
            _ => {
                // Default: copy streams
                args.extend([
                    "-c".to_string(),
                    "copy".to_string(),
                ]);
            }
        }

        args.push(output_str.clone());

        let output_result = Command::new(&self.exe_path)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| format!("Falha ao executar ffmpeg: {}. Certifique-se de que o ffmpeg está instalado.", e))?;

        if !output_result.status.success() {
            let stderr = String::from_utf8_lossy(&output_result.stderr);
            return Err(format!("Erro na conversão: {}", stderr));
        }

        Ok(output_str)
    }
}

impl Default for FFmpeg {
    fn default() -> Self {
        Self::new()
    }
}

