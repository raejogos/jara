// Client-side file conversion using browser APIs and ffmpeg.wasm
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { jsPDF } from "jspdf";

let ffmpeg: FFmpeg | null = null;
let ffmpegLoaded = false;

// Initialize ffmpeg.wasm
async function loadFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
  if (ffmpeg && ffmpegLoaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on("progress", ({ progress }) => {
    onProgress?.(Math.round(progress * 100));
  });

  // Load ffmpeg core from CDN
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpegLoaded = true;
  return ffmpeg;
}

// Convert media (audio/video) using ffmpeg.wasm
export async function convertMedia(
  file: File,
  outputFormat: string,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const ff = await loadFFmpeg(onProgress);

  const inputName = `input.${file.name.split(".").pop()}`;
  const outputName = `output.${outputFormat}`;

  // Write input file to ffmpeg virtual filesystem
  await ff.writeFile(inputName, await fetchFile(file));

  // Build ffmpeg arguments based on output format
  const args = ["-i", inputName];

  switch (outputFormat.toLowerCase()) {
    case "mp3":
      args.push("-vn", "-acodec", "libmp3lame", "-q:a", "2");
      break;
    case "wav":
      args.push("-vn", "-acodec", "pcm_s16le");
      break;
    case "m4a":
      args.push("-vn", "-acodec", "aac", "-b:a", "192k");
      break;
    case "flac":
      args.push("-vn", "-acodec", "flac");
      break;
    case "webm":
      args.push("-c:v", "libvpx", "-c:a", "libvorbis");
      break;
    case "mp4":
      args.push("-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart");
      break;
    case "mkv":
      args.push("-c:v", "copy", "-c:a", "copy");
      break;
  }

  args.push(outputName);

  // Run ffmpeg
  await ff.exec(args);

  // Read output file
  const data = await ff.readFile(outputName);
  
  // Clean up
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);

  // Get MIME type
  const mimeTypes: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    flac: "audio/flac",
    webm: "video/webm",
    mp4: "video/mp4",
    mkv: "video/x-matroska",
  };

  // Convert Uint8Array to ArrayBuffer specifically for Blob
  const buffer = data instanceof Uint8Array ? data.buffer : data;
  return new Blob([buffer as BlobPart], { type: mimeTypes[outputFormat] || "application/octet-stream" });
}

// Convert image using Canvas API (fast, native)
export async function convertImage(
  file: File,
  outputFormat: string,
  quality: number = 0.9
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Get MIME type
      const mimeTypes: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        gif: "image/gif",
        bmp: "image/bmp",
      };

      const mimeType = mimeTypes[outputFormat.toLowerCase()];
      if (!mimeType) {
        reject(new Error(`Unsupported format: ${outputFormat}`));
        return;
      }

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to convert image"));
          }
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

// Convert image to PDF
export async function imageToPDF(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      // Calculate dimensions (A4 max, maintain aspect ratio)
      const maxWidth = 210; // A4 width in mm
      const maxHeight = 297; // A4 height in mm
      
      let width = img.width * 0.264583; // px to mm (assuming 96 DPI)
      let height = img.height * 0.264583;

      // Scale down if needed
      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = height * ratio;
      }
      if (height > maxHeight) {
        const ratio = maxHeight / height;
        height = maxHeight;
        width = width * ratio;
      }

      const orientation = width > height ? "landscape" : "portrait";
      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: [width, height],
      });

      // Add image to PDF
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgData, "JPEG", 0, 0, width, height);

      URL.revokeObjectURL(url);
      resolve(pdf.output("blob"));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

// Main convert function - auto-detects type
export async function convertFile(
  file: File,
  outputFormat: string,
  onProgress?: (progress: number) => void
): Promise<{ blob: Blob; filename: string }> {
  const inputExt = file.name.split(".").pop()?.toLowerCase() || "";
  const outputExt = outputFormat.toLowerCase();

  // Determine input type
  const imageExts = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff"];
  const audioExts = ["mp3", "wav", "m4a", "flac", "aac", "ogg"];
  const videoExts = ["mp4", "mkv", "webm", "avi", "mov"];

  const isInputImage = imageExts.includes(inputExt);
  const isInputAudio = audioExts.includes(inputExt);
  const isInputVideo = videoExts.includes(inputExt);

  const isOutputImage = imageExts.includes(outputExt);
  const isOutputPDF = outputExt === "pdf";

  let blob: Blob;

  // Image to Image
  if (isInputImage && isOutputImage) {
    blob = await convertImage(file, outputFormat);
  }
  // Image to PDF
  else if (isInputImage && isOutputPDF) {
    blob = await imageToPDF(file);
  }
  // Audio/Video conversion
  else if ((isInputAudio || isInputVideo) && (audioExts.includes(outputExt) || videoExts.includes(outputExt))) {
    blob = await convertMedia(file, outputFormat, onProgress);
  }
  else {
    throw new Error(`Conversão de ${inputExt} para ${outputFormat} não suportada`);
  }

  // Generate output filename
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const filename = `${baseName}.${outputFormat}`;

  return { blob, filename };
}

// Download blob as file
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

