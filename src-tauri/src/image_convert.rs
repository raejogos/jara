use image::{DynamicImage, ImageFormat};
use std::path::PathBuf;

pub struct ImageConverter;

impl ImageConverter {
    pub fn new() -> Self {
        Self
    }

    pub fn convert(&self, input_path: &str, output_format: &str) -> Result<String, String> {
        let input = PathBuf::from(input_path);
        
        if !input.exists() {
            return Err("Arquivo de entrada não encontrado".to_string());
        }

        // Load image
        let img = image::open(&input)
            .map_err(|e| format!("Falha ao abrir imagem: {}", e))?;

        // Determine output format
        let format = match output_format.to_lowercase().as_str() {
            "png" => ImageFormat::Png,
            "jpg" | "jpeg" => ImageFormat::Jpeg,
            "webp" => ImageFormat::WebP,
            "gif" => ImageFormat::Gif,
            "bmp" => ImageFormat::Bmp,
            "ico" => ImageFormat::Ico,
            "tiff" => ImageFormat::Tiff,
            _ => return Err(format!("Formato não suportado: {}", output_format)),
        };

        // Generate output path
        let output = input.with_extension(output_format.to_lowercase());
        let output_str = output.to_string_lossy().to_string();

        // Handle ICO specially (needs resizing)
        let img_to_save: DynamicImage = if format == ImageFormat::Ico {
            img.resize(256, 256, image::imageops::FilterType::Lanczos3)
        } else {
            img
        };

        // Save with appropriate quality
        match format {
            ImageFormat::Jpeg => {
                let rgb_img = img_to_save.to_rgb8();
                let mut output_file = std::fs::File::create(&output)
                    .map_err(|e| format!("Falha ao criar arquivo: {}", e))?;
                
                let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output_file, 90);
                encoder.encode(
                    rgb_img.as_raw(),
                    rgb_img.width(),
                    rgb_img.height(),
                    image::ExtendedColorType::Rgb8
                ).map_err(|e| format!("Falha ao salvar JPEG: {}", e))?;
            }
            _ => {
                img_to_save.save_with_format(&output, format)
                    .map_err(|e| format!("Falha ao salvar imagem: {}", e))?;
            }
        }

        Ok(output_str)
    }
}

impl Default for ImageConverter {
    fn default() -> Self {
        Self::new()
    }
}
