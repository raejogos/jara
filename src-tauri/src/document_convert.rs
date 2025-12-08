use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;

pub struct DocumentConverter;

impl DocumentConverter {
    pub fn new() -> Self {
        Self
    }

    pub fn convert(&self, input_path: &str, output_format: &str) -> Result<String, String> {
        let input = PathBuf::from(input_path);
        
        if !input.exists() {
            return Err("Arquivo de entrada não encontrado".to_string());
        }

        let input_ext = input.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        match (input_ext.as_str(), output_format.to_lowercase().as_str()) {
            // Image to PDF
            ("png" | "jpg" | "jpeg" | "webp" | "bmp", "pdf") => {
                self.image_to_pdf(input_path)
            }
            // PDF to image - would need a PDF rendering library
            ("pdf", "png" | "jpg" | "jpeg") => {
                Err("Conversão de PDF para imagem requer ferramentas externas. Use um conversor online.".to_string())
            }
            _ => Err(format!("Conversão de {} para {} não suportada", input_ext, output_format)),
        }
    }

    fn image_to_pdf(&self, input_path: &str) -> Result<String, String> {
        use printpdf::{Image, ImageTransform, ImageXObject, Mm, PdfDocument, Px, ColorSpace, ColorBits};
        
        let input = PathBuf::from(input_path);
        
        // Load image using the image crate (with :: prefix to avoid conflict)
        let img = ::image::open(&input)
            .map_err(|e| format!("Falha ao abrir imagem: {}", e))?;
        
        let (img_width, img_height) = (img.width() as f32, img.height() as f32);

        // Create PDF with image dimensions (convert pixels to mm at 96 DPI)
        let dpi = 96.0;
        let width_mm = Mm((img_width / dpi) * 25.4);
        let height_mm = Mm((img_height / dpi) * 25.4);

        let (doc, page1, layer1) = PdfDocument::new(
            "Converted Image",
            width_mm,
            height_mm,
            "Layer 1",
        );

        let current_layer = doc.get_page(page1).get_layer(layer1);

        // Convert image to RGB bytes for PDF
        let rgb_img = img.to_rgb8();
        let raw_pixels = rgb_img.as_raw().clone();
        
        // Create image for PDF
        let pdf_image = Image::try_from(ImageXObject {
            width: Px(img.width() as usize),
            height: Px(img.height() as usize),
            color_space: ColorSpace::Rgb,
            bits_per_component: ColorBits::Bit8,
            interpolate: true,
            image_data: raw_pixels,
            image_filter: None,
            smask: None,
            clipping_bbox: None,
        }).map_err(|e| format!("Falha ao criar imagem PDF: {:?}", e))?;
        
        // Add image to PDF
        pdf_image.add_to_layer(
            current_layer,
            ImageTransform {
                translate_x: Some(Mm(0.0)),
                translate_y: Some(Mm(0.0)),
                scale_x: Some(width_mm.0 / img_width),
                scale_y: Some(height_mm.0 / img_height),
                ..Default::default()
            },
        );

        // Save PDF
        let output = input.with_extension("pdf");
        let output_str = output.to_string_lossy().to_string();
        
        let file = File::create(&output)
            .map_err(|e| format!("Falha ao criar arquivo PDF: {}", e))?;
        let mut writer = BufWriter::new(file);
        
        doc.save(&mut writer)
            .map_err(|e| format!("Falha ao salvar PDF: {}", e))?;

        Ok(output_str)
    }
}

impl Default for DocumentConverter {
    fn default() -> Self {
        Self::new()
    }
}
