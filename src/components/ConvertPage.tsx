import { useState, useCallback, useRef, useEffect } from "react";
import { platform } from "../services/api";
import { convertFile, downloadBlob } from "../services/converter";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { PDFDocument } from 'pdf-lib';
import { pngToIco } from "../utils/ico";
import QRCode from 'qrcode';

type ConvertCategory = "media" | "image" | "document";

interface ConvertOption {
  id: string;
  label: string;
  extensions: string[];
}

// Preset Interface
interface Preset {
  id: string;
  name: string;
  description: string;
  icon: "audio" | "video" | "image" | "document" | "speech"; // Added speech
  toFormat: string;
  inputExtensions: string[];
  category: ConvertCategory;
}

const quickPresets: Preset[] = [
  {
    id: "webp-to-png",
    name: "WEBP → PNG",
    description: "formato universal",
    icon: "image",
    inputExtensions: ["webp"],
    toFormat: "png",
    category: "image",
  },
  {
    id: "video-to-mp3",
    name: "Extrair Áudio",
    description: "extrair faixa de áudio",
    icon: "audio",
    toFormat: "mp3",
    inputExtensions: ["mp4", "mkv", "webm", "mov"],
    category: "media"
  },
  {
    id: "transcribe-audio",
    name: "Transcrição com IA",
    description: "áudio para texto",
    icon: "speech",
    toFormat: "txt",
    inputExtensions: ["mp3", "wav", "m4a", "ogg", "mp4"],
    category: "media"
  },
  {
    id: "image-to-pdf",
    name: "Imagem → PDF",
    description: "JPG, PNG → PDF",
    icon: "document",
    inputExtensions: ["jpg", "jpeg", "png", "webp", "bmp"],
    toFormat: "pdf",
    category: "document",
  },
  {
    id: "mkv-to-mp4",
    name: "MKV → MP4",
    description: "vídeo compatível",
    icon: "video",
    toFormat: "mp4",
    inputExtensions: ["mkv"],
    category: "media"
  },
  {
    id: "wav-to-mp3",
    name: "WAV → MP3",
    description: "reduzir áudio",
    icon: "audio",
    toFormat: "mp3",
    inputExtensions: ["wav"],
    category: "media"
  }
];

const formatsByCategory: Record<ConvertCategory, ConvertOption[]> = {
  media: [
    { id: "mp3", label: "MP3", extensions: ["mp4", "mkv", "webm", "avi", "mov", "wav", "flac", "m4a", "ogg"] },
    { id: "mp4", label: "MP4", extensions: ["mkv", "webm", "avi", "mov"] },
    { id: "mkv", label: "MKV", extensions: ["mp4", "webm", "avi", "mov"] },
    { id: "wav", label: "WAV", extensions: ["mp3", "flac", "m4a", "ogg", "aac"] },
    { id: "flac", label: "FLAC", extensions: ["mp3", "wav", "m4a", "ogg"] },
    { id: "m4a", label: "M4A", extensions: ["mp3", "wav", "flac", "ogg"] },
    { id: "webm", label: "WEBM", extensions: ["mp4", "mkv", "avi", "mov"] },
  ],
  image: [
    { id: "png", label: "PNG", extensions: ["jpg", "jpeg", "webp", "gif", "bmp", "tiff", "ico"] },
    { id: "jpg", label: "JPG", extensions: ["png", "webp", "gif", "bmp", "tiff"] },
    { id: "webp", label: "WEBP", extensions: ["png", "jpg", "jpeg", "gif", "bmp"] },
    { id: "gif", label: "GIF", extensions: ["png", "jpg", "jpeg", "webp"] },
    { id: "bmp", label: "BMP", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
  ],
  document: [
    { id: "pdf", label: "PDF", extensions: ["png", "jpg", "jpeg", "webp", "bmp"] },
  ],
};

const acceptByCategory: Record<ConvertCategory, string> = {
  media: ".mp4,.mkv,.webm,.avi,.mov,.mp3,.wav,.flac,.m4a,.aac,.ogg",
  image: ".png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff",
  document: ".png,.jpg,.jpeg,.webp,.bmp",
};

export function ConvertPage({ initialAction }: { initialAction?: string }) {
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [category, setCategory] = useState<ConvertCategory>("media");

  // ... rest of state ...
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState("mp3");
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFFmpeg, setIsLoadingFFmpeg] = useState(false);
  const [conversionResult, setConversionResult] = useState<{ url: string; filename: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image tools state
  const [activeImageTool, setActiveImageTool] = useState<"remove-bg" | "compress" | "svg-editor" | null>(null);
  const [imageToolFile, setImageToolFile] = useState<File | null>(null);
  const [imageToolResult, setImageToolResult] = useState<string | null>(null);
  const [imageToolProgress, setImageToolProgress] = useState(0);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string | null>(null);
  const imageToolInputRef = useRef<HTMLInputElement>(null);

  // SVG Editor State
  const [svgCode, setSvgCode] = useState<string>(`<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="80" fill="#3b82f6" />
  <path d="M60 100 L140 100 M100 60 L100 140" stroke="white" stroke-width="20" stroke-linecap="round" />
</svg>`);

  // Background removal options
  const [bgRemovalModel, setBgRemovalModel] = useState<"isnet_fp16" | "isnet_quint8">("isnet_fp16");
  const [bgRemovalQuality, setBgRemovalQuality] = useState(0.8);
  const [activeAudioTool, setActiveAudioTool] = useState<"transcribe" | null>(null);

  // Audio/Transcription state
  const [audioToolFile, setAudioToolFile] = useState<File | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [modelLoadingStatus, setModelLoadingStatus] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Video tools state
  const [activeVideoTool, setActiveVideoTool] = useState<"trim" | "to-gif" | "extract-frame" | null>(null);
  const [videoToolFile, setVideoToolFile] = useState<File | null>(null);
  const [videoToolResult, setVideoToolResult] = useState<string | null>(null);
  const [videoToolProgress, setVideoToolProgress] = useState(0);
  const [videoToolStatus, setVideoToolStatus] = useState<string>("");
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const videoToolInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Video tool options
  const [frameTime, setFrameTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(10);
  const [videoDuration, setVideoDuration] = useState(0);

  // Document tools state - PDF
  const [activeDocumentTool, setActiveDocumentTool] = useState<"merge" | "split" | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [pdfSplitFile, setPdfSplitFile] = useState<File | null>(null);
  const [pdfPageRange, setPdfPageRange] = useState("");
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfResult, setPdfResult] = useState<string | null>(null);

  // Utils State - QR Code & Base64 & Colors & EXIF
  const [activeUtilTool, setActiveUtilTool] = useState<"qr-code" | "base64" | "color-palette" | "color-picker" | "exif" | null>(null);
  const [qrText, setQrText] = useState("http://capijara.online/");
  const [qrColor, setQrColor] = useState("#000000");
  const [qrBgColor, setQrBgColor] = useState("#ffffff");
  const [qrResult, setQrResult] = useState<string | null>(null);

  // Base64 State
  const [base64Mode, setBase64Mode] = useState<"encode" | "decode">("encode");
  const [base64Input, setBase64Input] = useState("");
  const [base64Output, setBase64Output] = useState("");

  // Color Tools State
  const [paletteImage, setPaletteImage] = useState<string | null>(null);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [pickerColor, setPickerColor] = useState("#3b82f6");
  const [pickerImage, setPickerImage] = useState<string | null>(null);
  const [magnifierPos, setMagnifierPos] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });
  const [hoverColor, setHoverColor] = useState("#000000");

  // EXIF Tool State
  const [exifImage, setExifImage] = useState<string | null>(null);
  const [exifData, setExifData] = useState<{ [key: string]: string } | null>(null);
  const [cleanedImage, setCleanedImage] = useState<string | null>(null);

  // Handle deep linking from Home
  useEffect(() => {
    if (!initialAction) return;

    // Reset all states first
    handleBack();

    // Map actions to tools/presets
    if (initialAction === 'trim-video') {
      setActiveVideoTool('trim');
    } else if (initialAction === 'video-to-gif') {
      setActiveVideoTool('to-gif');
    } else if (initialAction === 'remove-bg') {
      setActiveImageTool('remove-bg');
    } else if (initialAction === 'compress-image') {
      setActiveImageTool('compress');
    } else if (initialAction === 'transcribe-audio') {
      setActiveAudioTool('transcribe');
    } else if (initialAction === 'merge-pdf') {
      setActiveDocumentTool('merge');
    } else if (initialAction === 'split-pdf') {
      setActiveDocumentTool('split');
    } else if (initialAction === 'svg-editor') {
      setActiveImageTool('svg-editor');
    } else if (initialAction === 'qr-code') {
      setActiveUtilTool('qr-code');
    } else if (initialAction === 'base64') {
      setActiveUtilTool('base64');
    } else if (initialAction === 'color-palette') {
      setActiveUtilTool('color-palette');
    } else if (initialAction === 'color-picker') {
      setActiveUtilTool('color-picker');
    } else if (initialAction === 'exif') {
      setActiveUtilTool('exif');
    } else {
      // Check standard presets
      const preset = quickPresets.find(p => p.id === initialAction);
      if (preset) {
        handlePresetSelect(preset);
      }
    }
  }, [initialAction]);

  // Initialize Transcription Worker
  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/transcribe.worker.js', import.meta.url), {
        type: 'module'
      });

      workerRef.current.onmessage = (event) => {
        const { type, data } = event.data;
        if (type === 'download') {
          if (data.status === 'progress') {
            setModelLoadingStatus(`Baixando IA: ${Math.round(data.progress || 0)}%`);
          } else if (data.status === 'initiate') {
            setModelLoadingStatus("Baixando modelo de IA...");
          }
        } else if (type === 'ready') {
          setModelLoadingStatus(null);
        } else if (type === 'result') {
          setTranscriptionResult(data);
          setIsTranscribing(false);
          setSuccess("Transcrição concluída!");
          setModelLoadingStatus(null);
        } else if (type === 'error') {
          setError(`Erro na IA: ${data}`);
          setIsTranscribing(false);
          setModelLoadingStatus(null);
        }
      };
    }

    return () => {
      // We generally don't terminate the worker here to keep model loaded, 
      // but if unmounting logic implies full reset:
      // workerRef.current?.terminate();
    };
  }, []);

  // Stable video URL to prevent re-renders
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Also handle preset selection for Transcribe
  const handlePresetSelect = (preset: Preset) => {
    if (preset.id === 'transcribe-audio') {
      setActiveAudioTool('transcribe');
      setSelectedPreset(null); // Don't use default preset flow
      return;
    }

    setSelectedPreset(preset);
    setIsCustomMode(false);
    setSelectedFile(null);
    setSelectedFilePath(null);
    setError(null);
    setSuccess(null);
    setOutputFormat(preset.toFormat);
  };

  const handleCustomMode = () => {
    setSelectedPreset(null);
    setIsCustomMode(true);
    setCategory("media");
    setOutputFormat("mp3");
    setError(null);
    setSuccess(null);
  };

  const handleBack = () => {
    setSelectedPreset(null);
    setIsCustomMode(false);
    setSelectedFile(null);
    setSelectedFilePath(null);
    setError(null);
    setSuccess(null);
    setProgress(0);
    // Also reset image tools
    setActiveImageTool(null);
    setImageToolFile(null);
    setImageToolResult(null);
    setImageToolProgress(0);
    if (activeImageTool === "svg-editor") {
      // Reset to default template if leaving editor? Maybe keep it? 
      // Let's keep it for now or reset if needed. 
      // For now, let's behave like other tools and reset selection logic, but state persistency might be nice.
      // Actually, let's strictly follow the "Back" pattern which resets everything.
      setSvgCode(`<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="80" fill="#3b82f6" />
  <path d="M60 100 L140 100 M100 60 L100 140" stroke="white" stroke-width="20" stroke-linecap="round" />
</svg>`);
    }
    // Also reset video tools
    setActiveVideoTool(null);
    setVideoToolFile(null);
    setVideoToolResult(null);
    setVideoToolProgress(0);
    // Reset Audio Tools
    setActiveAudioTool(null);
    setAudioToolFile(null);
    setTranscriptionResult(null);
    setTranscriptionResult(null);
    setIsTranscribing(false);
    // Reset Document Tools
    setActiveDocumentTool(null);
    setPdfFiles([]);
    setPdfSplitFile(null);
    setPdfResult(null);
    setPdfPageRange('');
    // Reset Utils
    setActiveUtilTool(null);
    setQrText("https://capijara.online");
    setQrResult(null);
    setBase64Input("");
    setBase64Output("");
    setBase64Mode("encode");
    setPaletteImage(null);
    setExtractedColors([]);
    setPickerColor("#3b82f6");
    setPickerImage(null);
    setExifImage(null);
    setExifData(null);
    setCleanedImage(null);

    setFrameTime(0);
    setTrimStart(0);
    setTrimEnd(10);
    setVideoDuration(0);
  };

  const handleCategoryChange = (newCategory: ConvertCategory) => {
    setCategory(newCategory);
    setSelectedFile(null);
    setSelectedFilePath(null);
    setError(null);
    setSuccess(null);
    setConversionResult(null);
    setOutputFormat(formatsByCategory[newCategory][0].id);
  };

  // Image tools handlers
  const handleImageToolSelect = (tool: "remove-bg" | "compress" | "svg-editor") => {
    setActiveImageTool(tool);
    setImageToolFile(null);
    setImageToolResult(null);
    setError(null);
    setSuccess(null);
    setImageToolProgress(0);
  };

  const handleSvgExport = async (format: "svg" | "png" | "ico") => {
    try {
      if (format === "svg") {
        const blob = new Blob([svgCode], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `icon_${Date.now()}.svg`;
        a.click();
        URL.revokeObjectURL(url);
        setSuccess("SVG baixado com sucesso!");
      } else {
        // Convert to bitmap (PNG/ICO)
        const img = new Image();
        const svgBlob = new Blob([svgCode], { type: "image/svg+xml" });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
          const canvas = document.createElement("canvas");
          // Use viewBox or width/height attributes, default to 512 for generic export if not specified
          canvas.width = img.width || 512;
          canvas.height = img.height || 512;

          if (format === "ico") {
            // Resize to standard ICO size if strictly needed, but 256 is good
            canvas.width = 256;
            canvas.height = 256;
          }

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas context failed");

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(async (blob) => {
            if (!blob) throw new Error("Blob creation failed");

            let finalBlob = blob;
            if (format === "ico") {
              finalBlob = await pngToIco(blob);
            }

            const downloadUrl = URL.createObjectURL(finalBlob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `icon_${Date.now()}.${format}`;
            a.click();
            URL.revokeObjectURL(downloadUrl);
            URL.revokeObjectURL(url);
            setSuccess(`${format.toUpperCase()} baixado com sucesso!`);
          }, "image/png");
        };

        img.onerror = () => {
          setError("Erro ao renderizar SVG. Verifique o código.");
          URL.revokeObjectURL(url);
        };

        img.src = url;
      }
    } catch (err) {
      console.error(err);
      setError("Erro na exportação.");
    }
  };

  const handleImageToolFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageToolFile(file);
      setImageToolResult(null);
      setError(null);
    }
  };

  const handleImageToolProcess = async () => {
    if (!imageToolFile) return;

    setIsProcessingImage(true);
    setError(null);
    setImageToolProgress(0);
    setEstimatedTimeRemaining(null);
    const startTime = Date.now();

    try {
      if (activeImageTool === "remove-bg") {
        setImageToolProgress(10);
        setEstimatedTimeRemaining("carregando modelo...");
        // Dynamic import to avoid loading the heavy library upfront
        // @ts-ignore
        const { removeBackground } = await import("@imgly/background-removal");
        setImageToolProgress(30);

        const blob = await removeBackground(imageToolFile, {
          model: bgRemovalModel,
          output: {
            format: "image/png",
            quality: bgRemovalQuality,
          },
          progress: (_key: string, current: number, total: number) => {
            const p = Math.round((current / total) * 60) + 30;
            setImageToolProgress(Math.min(p, 90));

            // Calculate ETA
            const elapsed = Date.now() - startTime;
            const progressPercent = p / 100;
            if (progressPercent > 0.1) {
              const estimatedTotal = elapsed / progressPercent;
              const remaining = Math.max(0, estimatedTotal - elapsed);
              const remainingSec = Math.ceil(remaining / 1000);
              if (remainingSec > 60) {
                setEstimatedTimeRemaining(`~${Math.ceil(remainingSec / 60)}min restante`);
              } else if (remainingSec > 0) {
                setEstimatedTimeRemaining(`~${remainingSec}s restante`);
              } else {
                setEstimatedTimeRemaining("finalizando...");
              }
            }
          },
        });

        setImageToolProgress(100);
        setEstimatedTimeRemaining(null);
        const url = URL.createObjectURL(blob);
        setImageToolResult(url);
        setSuccess("Fundo removido com sucesso!");
      } else if (activeImageTool === "compress") {
        setImageToolProgress(20);
        // @ts-ignore
        const imageCompression = await import("browser-image-compression");

        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          onProgress: (p: number) => setImageToolProgress(Math.round(p * 0.8) + 20),
        };

        const compressedFile = await imageCompression.default(imageToolFile, options);
        setImageToolProgress(100);

        const url = URL.createObjectURL(compressedFile);
        setImageToolResult(url);

        const originalSize = (imageToolFile.size / 1024).toFixed(1);
        const newSize = (compressedFile.size / 1024).toFixed(1);
        const reduction = Math.round((1 - compressedFile.size / imageToolFile.size) * 100);
        setSuccess(`Comprimido: ${originalSize}KB → ${newSize}KB (-${reduction}%)`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao processar imagem");
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleDownloadResult = () => {
    if (!imageToolResult || !imageToolFile) return;

    const a = document.createElement("a");
    a.href = imageToolResult;
    const ext = activeImageTool === "remove-bg" ? "png" : imageToolFile.name.split(".").pop();
    const baseName = imageToolFile.name.replace(/\.[^/.]+$/, "");
    a.download = `${baseName}_${activeImageTool === "remove-bg" ? "nobg" : "compressed"}.${ext}`;
    a.click();
  };

  // Audio Tool Logic - reserved for future use

  const handleAudioToolFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setAudioToolFile(e.target.files[0]);
      setTranscriptionResult(null);
    }
  };

  const handleTranscribe = async () => {
    console.log("Transcribe button clicked");

    if (!workerRef.current) {
      console.error("Worker not initialized");
      setError("Erro: Worker de IA não inicializado. Recarregue a página.");
      return;
    }

    if (!audioToolFile) {
      console.error("No file selected");
      return;
    }

    setIsTranscribing(true);
    setTranscriptionResult(null);
    setError(null);
    setModelLoadingStatus("Inicializando...");

    try {
      // Decode audio in main thread because Worker doesn't have AudioContext
      const arrayBuffer = await audioToolFile.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Get the first channel
      let channelData = audioBuffer.getChannelData(0);

      console.log("Audio decoded:", {
        sampleRate: audioBuffer.sampleRate,
        length: channelData.length,
        duration: audioBuffer.duration
      });

      // Transformers.js Whisper expects 16kHz sample rate, but the pipeline usually handles
      // resampling if provided with Float32Array. We simply pass the raw data.

      workerRef.current.postMessage({
        type: 'run',
        data: {
          audio: channelData,
          language: 'portuguese',
          sampleRate: audioBuffer.sampleRate // Pass sample rate just in case we need it later
        }
      });

      // Close context to free resources
      audioContext.close();

    } catch (err) {
      console.error("Error starting transcription:", err);
      setError("Erro ao processar áudio: " + (err instanceof Error ? err.message : String(err)));
      setIsTranscribing(false);
    }
  };

  // PDF Tools Logic
  const handlePdfMerge = async () => {
    if (pdfFiles.length < 2) return;
    setIsProcessingPdf(true);
    setPdfResult(null);
    setSuccess(null);
    setError(null);

    try {
      const mergedPdf = await PDFDocument.create();
      for (const file of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfResult(url);
      setSuccess("PDFs juntados com sucesso!");
    } catch (error) {
      console.error("Error merging PDFs:", error);
      setError("Erro ao juntar PDFs. Verifique se os arquivos são válidos.");
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const handlePdfSplit = async () => {
    if (!pdfSplitFile || !pdfPageRange) return;
    setIsProcessingPdf(true);
    setPdfResult(null);
    setSuccess(null);
    setError(null);

    try {
      const arrayBuffer = await pdfSplitFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const newPdf = await PDFDocument.create();
      const totalPages = pdfDoc.getPageCount();

      const pagesToKeep = new Set<number>();
      const parts = pdfPageRange.split(',').map(p => p.trim());

      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(n => parseInt(n) - 1);
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = start; i <= end; i++) {
              if (i >= 0 && i < totalPages) pagesToKeep.add(i);
            }
          }
        } else {
          const page = parseInt(part) - 1;
          if (!isNaN(page) && page >= 0 && page < totalPages) {
            pagesToKeep.add(page);
          }
        }
      }

      const sortedPages = Array.from(pagesToKeep).sort((a, b) => a - b);
      if (sortedPages.length === 0) {
        throw new Error("Nenhuma página válida selecionada.");
      }

      const copiedPages = await newPdf.copyPages(pdfDoc, sortedPages);
      copiedPages.forEach(page => newPdf.addPage(page));

      const pdfBytes = await newPdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfResult(url);
      setSuccess("PDF cortado com sucesso!");
    } catch (error) {
      console.error("Error splitting PDF:", error);
      setError("Erro ao cortar PDF: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // Video Tools Logic
  const handleVideoToolSelect = (tool: "trim" | "to-gif" | "extract-frame") => {
    setActiveVideoTool(tool);
    setVideoToolFile(null);
    setVideoToolResult(null);
    setVideoToolProgress(0);
    setError(null);
    setSuccess(null);
    setFrameTime(0);
    setTrimStart(0);
    setTrimEnd(10);
  };

  const handleVideoToolFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoToolFile(file);
      setVideoToolResult(null);
      setError(null);
      setSuccess(null);

      // Create stable URL
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);

      // Load video metadata
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const duration = video.duration;
        setVideoDuration(duration);
        setTrimEnd(Math.min(10, duration));
      }
      video.src = url;
    }
  };

  const handleVideoToolProcess = async () => {
    if (!videoToolFile || !activeVideoTool) return;

    setIsProcessingVideo(true);
    setVideoToolProgress(0);
    setVideoToolStatus("Inicializando FFmpeg...");

    const ffmpeg = new FFmpeg();

    try {
      // Usar a mesma configuração do converter.ts que já funciona
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

      setVideoToolStatus("Carregando componentes (ESM)...");
      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript");
      const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm");

      console.log("URLs configuradas:", { coreURL, wasmURL });

      setVideoToolStatus("Inicializando Worker...");
      await ffmpeg.load({
        coreURL: coreURL,
        wasmURL: wasmURL,
        // Não passamos workerURL aqui pois o build ESM gerencia isso internamente ou não usa worker separado da mesma forma
      });
      console.log("FFmpeg carregado!");

      ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg Log:', message);
        if (message.includes("Loading")) setVideoToolStatus("Carregando recursos...");

        // Ignora logs irrelevantes
        if (message.includes("Aborted()") || message.includes("pthread")) return;

        if (message.includes("run")) setVideoToolStatus("Executando comando...");
      });

      setVideoToolStatus("Preparando arquivo de entrada...");
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoToolFile));

      let outputFilename = '';
      let mimeType = '';

      setVideoToolStatus("Configurando comando...");

      setVideoToolStatus("Executando operação...");
      console.log(`Iniciando processamento: ${activeVideoTool}`, { trimStart, trimEnd, duration: trimEnd - trimStart });

      if (activeVideoTool === 'trim') {
        outputFilename = 'trimmed.mp4';
        mimeType = 'video/mp4';
        const duration = trimEnd - trimStart;
        await ffmpeg.exec([
          '-ss', trimStart.toString(),
          '-i', 'input.mp4',
          '-t', duration.toString(),
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-c:a', 'aac',
          outputFilename
        ]);
      }
      else if (activeVideoTool === 'to-gif') {
        outputFilename = 'output.gif';
        mimeType = 'image/gif';
        const duration = trimEnd - trimStart;
        // Generate palette first for better quality
        await ffmpeg.exec([
          '-ss', trimStart.toString(),
          '-t', duration.toString(),
          '-i', 'input.mp4',
          '-vf', 'fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
          outputFilename
        ]);
      }


      setVideoToolStatus("Finalizando...");
      const data = await ffmpeg.readFile(outputFilename);
      const url = URL.createObjectURL(new Blob([data as any], { type: mimeType }));
      setVideoToolResult(url);
      setSuccess("Processamento concluído com sucesso!");

    } catch (e: any) {
      console.error(e);
      let msg = "Erro desconhecido";
      if (typeof e === 'string') msg = e;
      if (e instanceof Error) msg = e.message;
      // Provide actionable feedback if it's a SharedArrayBuffer issue (common in React dev)
      if (msg.includes("SharedArrayBuffer")) {
        setError("Erro: Navegador incompatible com FFmpeg (SharedArrayBuffer missing). Tente usar Chrome/Edge ou verifique headers de segurança.");
      } else {
        setError(`Erro ao processar: ${msg}`);
      }
    } finally {
      setIsProcessingVideo(false);
      ffmpeg.terminate();
    }
  };

  const handleDownloadVideoResult = () => {
    if (!videoToolResult || !activeVideoTool) return;

    const a = document.createElement("a");
    a.href = videoToolResult;

    let extension = 'mp4';
    if (activeVideoTool === 'to-gif') extension = 'gif';
    a.download = `jara_${activeVideoTool}_${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getAcceptString = () => {
    if (activeAudioTool === 'transcribe') return ".mp3,.wav,.ogg,.m4a,.mp4";
    if (selectedPreset) {
      return selectedPreset.inputExtensions.map(ext => `.${ext}`).join(",");
    }
    return acceptByCategory[category];
  };

  const handleSelectFile = async () => {
    if (platform.isTauri) {
      try {
        // @ts-ignore - Tauri plugin only available in desktop app
        const { open } = await import("@tauri-apps/plugin-dialog");
        const extensions = getAcceptString().replace(/\./g, "").split(",");

        const selected = await open({
          multiple: false,
          filters: [
            {
              name: category === "media" ? "Mídia" : category === "image" ? "Imagens" : "Documentos",
              extensions,
            },
          ],
        });

        if (selected && typeof selected === "string") {
          setSelectedFilePath(selected);
          setSelectedFile(null);
          setError(null);
          setSuccess(null);
        }
      } catch (e) {
        console.error("Failed to open file dialog:", e);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSelectedFilePath(null);
      setError(null);
      setSuccess(null);
    }
    e.target.value = "";
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (platform.isTauri) {
      setError("Use o botão para selecionar arquivos");
      return;
    }

    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setSelectedFilePath(null);
      setError(null);
      setSuccess(null);
      setConversionResult(null);
    }
  }, []);

  const handleConvert = async () => {
    if (!selectedFile && !selectedFilePath) return;

    setIsConverting(true);
    setProgress(0);
    setError(null);
    setSuccess(null);

    try {
      if (platform.isTauri && selectedFilePath) {
        // @ts-ignore - Tauri API only available in desktop app
        const { invoke } = await import("@tauri-apps/api/core");

        const progressInterval = setInterval(() => {
          setProgress(prev => Math.min(prev + 10, 90));
        }, 300);

        const command = category === "media" ? "convert_file" :
          category === "image" ? "convert_image" : "convert_document";

        const result = await invoke<string>(command, {
          inputPath: selectedFilePath,
          outputFormat: outputFormat,
        });

        clearInterval(progressInterval);
        setProgress(100);
        setSuccess(`Arquivo convertido: ${result.split(/[/\\]/).pop()}`);
      } else if (selectedFile) {
        if (category === "media") {
          setIsLoadingFFmpeg(true);
        }

        const { blob, filename } = await convertFile(
          selectedFile,
          outputFormat,
          (p) => setProgress(p)
        );

        setIsLoadingFFmpeg(false);
        setProgress(100);

        const url = URL.createObjectURL(blob);
        downloadBlob(blob, filename); // Keep auto-download
        setConversionResult({ url, filename });
        setSuccess(`Arquivo convertido: ${filename}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsConverting(false);
      setIsLoadingFFmpeg(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setSelectedFilePath(null);
    setError(null);
    setSuccess(null);
    setConversionResult(null);
    setProgress(0);
  };

  const currentFormats = formatsByCategory[category];
  const fileName = selectedFile?.name || selectedFilePath?.split(/[/\\]/).pop();
  const hasFile = selectedFile || selectedFilePath;
  const showPresetGrid = !selectedPreset && !isCustomMode && !activeImageTool && !activeVideoTool && !activeAudioTool && !activeDocumentTool && !activeUtilTool;

  return (
    <div className="h-full overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-6">

          {/* Hidden file input for web */}
          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptString()}
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* TOOLS GRID VIEW */}
          {showPresetGrid && (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-light text-white mb-2 font-display">
                  ferramentas
                </h2>
                <p className="text-gray-600 text-sm font-mono">
                  processamento 100% local
                </p>
              </div>

              {/* CONVERTER SECTION */}
              <div className="mb-8">
                <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-mono">converter</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {quickPresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                      style={{
                        borderColor: preset.id === 'webp-to-png' ? '#fbbf2420' :
                          preset.id === 'video-to-mp3' ? '#f472b620' :
                            preset.id === 'transcribe-audio' ? '#a78bfa20' : // purple
                              preset.id === 'image-to-pdf' ? '#f8717120' :
                                undefined,
                      }}
                    >
                      <div
                        className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                        style={{
                          backgroundColor: preset.id === 'webp-to-png' ? '#fbbf2420' :
                            preset.id === 'video-to-mp3' ? '#f472b620' :
                              preset.id === 'transcribe-audio' ? '#a78bfa20' :
                                preset.id === 'image-to-pdf' ? '#f8717120' :
                                  undefined,
                        }}
                      >
                        <PresetIcon
                          type={preset.icon}
                          className="w-5 h-5 transition-colors"
                          style={{
                            color: preset.id === 'webp-to-png' ? '#fbbf24' :
                              preset.id === 'video-to-mp3' ? '#f472b6' :
                                preset.id === 'transcribe-audio' ? '#a78bfa' :
                                  preset.id === 'image-to-pdf' ? '#f87171' :
                                    undefined,
                          }}
                        />
                      </div>
                      <p className="text-white text-sm font-medium mb-1">{preset.name}</p>
                      <p className="text-gray-500 text-xs font-mono">{preset.description}</p>
                    </button>
                  ))}

                  {/* Custom option */}
                  <button
                    onClick={handleCustomMode}
                    className="group p-4 bg-dark-900 border border-dashed border-dark-600 rounded-xl hover:border-white/30 transition-all text-left"
                  >
                    <div className="w-10 h-10 mb-3 bg-dark-700 rounded-lg flex items-center justify-center group-hover:bg-dark-600 transition-colors">
                      <svg className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    </div>
                    <p className="text-gray-400 text-sm font-medium mb-1 group-hover:text-white transition-colors">Personalizado</p>
                    <p className="text-gray-600 text-xs font-mono">escolher formatos</p>
                  </button>
                </div>
              </div>

              {/* IMAGE TOOLS SECTION */}
              <div>
                <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-mono">imagens</h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* Remove Background */}
                  <button
                    onClick={() => handleImageToolSelect("remove-bg")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#8b5cf620" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#8b5cf620" }}
                    >
                      <svg className="w-5 h-5" style={{ color: "#8b5cf6" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Remover Fundo</p>
                    <p className="text-gray-500 text-xs font-mono">IA local</p>
                  </button>

                  {/* Compress Image */}
                  <button
                    onClick={() => handleImageToolSelect("compress")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#10b98120" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#10b98120" }}
                    >
                      <svg className="w-5 h-5" style={{ color: "#10b981" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Comprimir</p>
                    <p className="text-gray-500 text-xs font-mono">reduzir tamanho</p>
                  </button>

                  {/* SVG Editor */}
                  <button
                    onClick={() => handleImageToolSelect("svg-editor")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#3b82f620" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#3b82f620" }}
                    >
                      <svg className="w-5 h-5" style={{ color: "#3b82f6" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Editor SVG</p>
                    <p className="text-gray-500 text-xs font-mono">criar ícones</p>
                  </button>
                </div>
              </div>

              {/* VIDEO TOOLS SECTION */}
              <div className="mt-8">
                <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-mono">vídeo</h3>
                <div className="grid grid-cols-2 gap-3">


                  {/* Trim Video */}
                  <button
                    onClick={() => handleVideoToolSelect("trim")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#ec489920" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#ec489920" }}
                    >
                      <svg className="w-5 h-5" style={{ color: "#ec4899" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Cortar Vídeo</p>
                    <p className="text-gray-500 text-xs font-mono">ajustar duração</p>
                  </button>

                  {/* To GIF */}
                  <button
                    onClick={() => handleVideoToolSelect("to-gif")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#efd62820" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#efd62820" }}
                    >
                      <svg className="w-5 h-5" style={{ color: "#efd628" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Vídeo para GIF</p>
                    <p className="text-gray-500 text-xs font-mono">criar animação</p>
                  </button>
                </div>
              </div>


              {/* DOCUMENT TOOLS SECTION */}
              <div className="mt-8">
                <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-mono">documentos</h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* Merge PDF */}
                  <button
                    onClick={() => setActiveDocumentTool("merge")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#f9731620" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#f9731620" }}
                    >
                      <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Juntar PDFs</p>
                    <p className="text-gray-500 text-xs font-mono">combinar arquivos</p>
                  </button>

                  {/* Split PDF */}
                  <button
                    onClick={() => setActiveDocumentTool("split")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#f9731620" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#f9731620" }}
                    >
                      <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Cortar PDF</p>
                    <p className="text-gray-500 text-xs font-mono">separar páginas</p>
                  </button>
                </div>
              </div>

              {/* UTILS TOOLS SECTION */}
              <div className="mt-8">
                <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-mono">utilitários</h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* QR Code */}
                  <button
                    onClick={() => setActiveUtilTool("qr-code")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#10b98120" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#10b98120" }}
                    >
                      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4h2v-4zm-1-8a9 9 0 00-9 9 9 9 0 009 9 9 9 0 009-9 9 9 0 00-9-9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9a2 2 0 012-2v0a2 2 0 012 2v0a2 2 0 01-2 2v0a2 2 0 01-2-2v0z" /> {/* Simplified QR icon */}
                        <rect x="5" y="5" width="4" height="4" rx="1" />
                        <rect x="15" y="5" width="4" height="4" rx="1" />
                        <rect x="5" y="15" width="4" height="4" rx="1" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">QR Code</p>
                    <p className="text-gray-500 text-xs font-mono">gerar código</p>
                  </button>

                  {/* Base64 */}
                  <button
                    onClick={() => setActiveUtilTool("base64")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#6366f120" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#6366f120" }}
                    >
                      <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Conversor Base64</p>
                    <p className="text-gray-500 text-xs font-mono">texto ↔ base64</p>
                  </button>

                  {/* Color Palette Extractor */}
                  <button
                    onClick={() => setActiveUtilTool("color-palette")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#f43f5e20" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#f43f5e20" }}
                    >
                      <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Extrair Paleta</p>
                    <p className="text-gray-500 text-xs font-mono">cores da imagem</p>
                  </button>

                  {/* Color Picker */}
                  <button
                    onClick={() => setActiveUtilTool("color-picker")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#8b5cf620" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#8b5cf620" }}
                    >
                      <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Conta-Gotas</p>
                    <p className="text-gray-500 text-xs font-mono">capturar cor</p>
                  </button>

                  {/* EXIF Viewer/Remover */}
                  <button
                    onClick={() => setActiveUtilTool("exif")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#f59e0b20" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#f59e0b20" }}
                    >
                      <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Ver EXIF</p>
                    <p className="text-gray-500 text-xs font-mono">ver/remover metadados</p>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* AUDIO/TRANSCRIPTION TOOL VIEW */}
          {activeAudioTool && (
            <div className="animate-fade-in">
              {/* Back button */}
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">voltar</span>
              </button>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-light text-white mb-2 font-display">Transcrição com IA</h2>
                <p className="text-gray-500 font-mono text-sm">áudio para texto (local)</p>
              </div>

              {/* File Selection */}
              {!audioToolFile ? (
                <label className="block border-2 border-dashed border-dark-600 rounded-2xl p-12 text-center cursor-pointer hover:border-purple-500/50 hover:bg-dark-800/50 transition-all">
                  <input type="file" className="hidden" accept=".mp3,.wav,.ogg,.m4a" onChange={handleAudioToolFileSelect} />
                  <div className="w-16 h-16 bg-dark-800 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <p className="text-gray-300 font-medium">Clique para escolher o áudio</p>
                  <p className="text-gray-500 text-xs mt-2 font-mono">MP3, WAV, OGG, M4A</p>
                </label>
              ) : (
                <div className="space-y-6">
                  <div className="bg-dark-800 p-4 rounded-xl border border-dark-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{audioToolFile.name}</p>
                        <p className="text-gray-500 text-xs font-mono">{(audioToolFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button onClick={() => setAudioToolFile(null)} className="text-gray-500 hover:text-white">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {!transcriptionResult && (
                    <button
                      onClick={handleTranscribe}
                      disabled={isTranscribing}
                      className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {isTranscribing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>{modelLoadingStatus || "Transcrevendo..."}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Iniciar Transcrição
                        </>
                      )}
                    </button>
                  )}

                  {transcriptionResult && (
                    <div className="animate-fade-in space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white text-sm font-medium">Resultado:</h3>
                        <button
                          onClick={() => {
                            const blob = new Blob([transcriptionResult.text], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `transcricao_${Date.now()}.txt`;
                            a.click();
                          }}
                          className="text-purple-400 hover:text-white text-xs font-mono flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          baixar .txt
                        </button>
                      </div>
                      <textarea
                        className="w-full h-64 bg-dark-900 border border-dark-700 rounded-xl p-4 text-gray-300 font-mono text-sm focus:outline-none focus:border-purple-500/50 resize-none"
                        value={transcriptionResult.text}
                        readOnly
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}


          {/* IMAGE TOOL VIEW */}
          {activeImageTool && (
            <>
              {/* Back button */}
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">voltar</span>
              </button>

              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-xl font-light text-white mb-1 font-display">
                  {activeImageTool === "remove-bg" ? "Remover Fundo" :
                    activeImageTool === "svg-editor" ? "Editor SVG" : "Comprimir Imagem"}
                </h2>
                <p className="text-gray-600 text-sm font-mono">
                  {activeImageTool === "remove-bg" ? "IA processa localmente" :
                    activeImageTool === "svg-editor" ? "crie e exporte ícones" : "reduz o tamanho do arquivo"}
                </p>
              </div>

              {/* Hidden file input */}
              <input
                ref={imageToolInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={handleImageToolFileSelect}
                className="hidden"
              />

              {/* Options for remove-bg */}
              {activeImageTool === "remove-bg" && !imageToolFile && (
                <div className="bg-dark-800 rounded-xl p-4 space-y-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">Modo</p>
                      <p className="text-gray-600 text-xs">rápido é menor mas pode ter artefatos</p>
                    </div>
                    <div className="flex bg-dark-900 rounded-lg p-1">
                      <button
                        onClick={() => setBgRemovalModel("isnet_quint8")}
                        className={`px-3 py-1.5 text-xs rounded-md transition-colors ${bgRemovalModel === "isnet_quint8"
                          ? "bg-dark-700 text-white"
                          : "text-gray-500 hover:text-gray-300"
                          }`}
                      >
                        rápido
                      </button>
                      <button
                        onClick={() => setBgRemovalModel("isnet_fp16")}
                        className={`px-3 py-1.5 text-xs rounded-md transition-colors ${bgRemovalModel === "isnet_fp16"
                          ? "bg-dark-700 text-white"
                          : "text-gray-500 hover:text-gray-300"
                          }`}
                      >
                        qualidade
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white text-sm font-medium">Qualidade da saída</p>
                      <span className="text-gray-500 text-xs font-mono">{Math.round(bgRemovalQuality * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={bgRemovalQuality}
                      onChange={(e) => setBgRemovalQuality(parseFloat(e.target.value))}
                      className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-white"
                    />
                  </div>
                </div>
              )}

              {/* SVG EDITOR VIEW */}
              {activeImageTool === "svg-editor" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
                    {/* Code Editor */}
                    <div className="flex flex-col h-full bg-dark-900 rounded-xl border border-dark-700 overflow-hidden">
                      <div className="px-4 py-2 bg-dark-800 border-b border-dark-700 flex justify-between items-center">
                        <span className="text-xs font-mono text-gray-400">código svg</span>
                      </div>
                      <textarea
                        value={svgCode}
                        onChange={(e) => setSvgCode(e.target.value)}
                        className="flex-1 w-full bg-transparent p-4 text-sm font-mono text-blue-300 focus:outline-none resize-none"
                        spellCheck={false}
                      />
                    </div>

                    {/* Preview */}
                    <div className="flex flex-col h-full bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
                      <div className="px-4 py-2 bg-dark-800 border-b border-dark-700 flex justify-between items-center">
                        <span className="text-xs font-mono text-gray-400">preview</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center p-8 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMjIyIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMyMjIiLz48L3N2Zz4=')]">
                        <div dangerouslySetInnerHTML={{ __html: svgCode }} className="max-w-full max-h-full" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleSvgExport('svg')}
                      className="flex-1 py-3 bg-dark-700 border border-dark-600 text-white rounded-lg font-medium text-sm hover:bg-dark-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Baixar SVG
                    </button>
                    <button
                      onClick={() => handleSvgExport('png')}
                      className="flex-1 py-3 bg-dark-700 border border-dark-600 text-white rounded-lg font-medium text-sm hover:bg-dark-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Baixar PNG
                    </button>
                    <button
                      onClick={() => handleSvgExport('ico')}
                      className="flex-1 py-3 bg-dark-700 border border-dark-600 text-white rounded-lg font-medium text-sm hover:bg-dark-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Baixar ICO
                    </button>
                  </div>
                </div>
              )}

              {/* File drop zone - Only show if not editing SVG */}
              {!imageToolFile && activeImageTool !== 'svg-editor' && (
                <div
                  onClick={() => imageToolInputRef.current?.click()}
                  className="border-2 border-dashed border-dark-600 rounded-xl p-12 text-center cursor-pointer hover:border-dark-500 transition-colors"
                >
                  <svg className="w-12 h-12 mx-auto text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-400 text-sm mb-1">clique para selecionar imagem</p>
                  <p className="text-gray-600 text-xs font-mono">PNG, JPG, WEBP</p>
                </div>
              )}

              {/* Preview and process */}
              {imageToolFile && (
                <div className="space-y-4">
                  {/* Image preview */}
                  <div className="bg-dark-800 rounded-xl p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-500 text-xs mb-2 font-mono">original</p>
                        <img
                          src={URL.createObjectURL(imageToolFile)}
                          alt="Original"
                          className="w-full h-48 object-contain bg-dark-900 rounded-lg"
                        />
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-2 font-mono">resultado</p>
                        {imageToolResult ? (
                          <img
                            src={imageToolResult}
                            alt="Result"
                            className="w-full h-48 object-contain bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMjIyIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMyMjIiLz48L3N2Zz4=')] rounded-lg"
                          />
                        ) : (
                          <div className="w-full h-48 bg-dark-900 rounded-lg flex items-center justify-center">
                            {isProcessingImage ? (
                              <div className="text-center">
                                <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin mx-auto mb-2" />
                                <p className="text-gray-500 text-xs font-mono">{imageToolProgress}%</p>
                                {estimatedTimeRemaining && (
                                  <p className="text-gray-600 text-xs font-mono mt-1">{estimatedTimeRemaining}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-gray-600 text-xs font-mono">aguardando...</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setImageToolFile(null);
                        setImageToolResult(null);
                        setSuccess(null);
                      }}
                      className="px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-gray-400 hover:text-white transition-colors text-sm"
                    >
                      trocar imagem
                    </button>

                    {!imageToolResult ? (
                      <button
                        onClick={handleImageToolProcess}
                        disabled={isProcessingImage}
                        className="flex-1 py-3 bg-white text-black rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        {isProcessingImage ? "processando..." : activeImageTool === "remove-bg" ? "remover fundo" : "comprimir"}
                      </button>
                    ) : (
                      <button
                        onClick={handleDownloadResult}
                        className="flex-1 py-3 bg-white text-black rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        baixar
                      </button>
                    )}
                  </div>

                  {/* Success message */}
                  {success && (
                    <div className="p-3 bg-dark-800 border border-dark-600 rounded-lg text-green-400 text-sm">
                      {success}
                    </div>
                  )}

                  {/* Error message */}
                  {error && (
                    <div className="p-3 bg-dark-800 border border-dark-600 rounded-lg text-red-400 text-sm">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* PDF TOOLS VIEW */}
          {activeDocumentTool && (
            <div className="animate-fade-in">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">voltar</span>
              </button>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-light text-white mb-2 font-display">
                  {activeDocumentTool === 'merge' ? 'Juntar PDFs' : 'Cortar PDF'}
                </h2>
                <p className="text-gray-500 font-mono text-sm">
                  {activeDocumentTool === 'merge' ? 'Combine múltiplos arquivos em um só' : 'Extraia páginas específicas'}
                </p>
              </div>

              {/* Merge Tool UI */}
              {activeDocumentTool === 'merge' && (
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-dark-600 rounded-xl p-12 text-center hover:border-dark-500 transition-colors bg-dark-800/20">
                    <input
                      type="file"
                      multiple
                      accept=".pdf"
                      onChange={(e) => {
                        if (e.target.files) {
                          setPdfFiles(Array.from(e.target.files));
                          setPdfResult(null);
                          setSuccess(null);
                        }
                      }}
                      className="hidden"
                      id="pdf-merge-input"
                    />
                    <label htmlFor="pdf-merge-input" className="cursor-pointer flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-dark-700 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-400">
                        {pdfFiles.length > 0 ? (
                          <span className="text-white font-medium">{pdfFiles.length} arquivos selecionados</span>
                        ) : (
                          <span>Clique para selecionar PDFs</span>
                        )}
                      </div>
                    </label>
                  </div>

                  {pdfFiles.length > 0 && (
                    <button
                      onClick={handlePdfMerge}
                      disabled={isProcessingPdf}
                      className="w-full py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 shadow-xl shadow-white/10"
                    >
                      {isProcessingPdf ? "Processando..." : "Juntar PDFs Agora"}
                    </button>
                  )}
                </div>
              )}

              {/* Split Tool UI */}
              {activeDocumentTool === 'split' && (
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-dark-600 rounded-xl p-12 text-center hover:border-dark-500 transition-colors bg-dark-800/20">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setPdfSplitFile(e.target.files[0]);
                          setPdfResult(null);
                          setSuccess(null);
                        }
                      }}
                      className="hidden"
                      id="pdf-split-input"
                    />
                    <label htmlFor="pdf-split-input" className="cursor-pointer flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-dark-700 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-400">
                        {pdfSplitFile ? (
                          <span className="text-white font-medium">{pdfSplitFile.name}</span>
                        ) : (
                          <span>Clique para selecionar PDF</span>
                        )}
                      </div>
                    </label>
                  </div>

                  {pdfSplitFile && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Páginas para extrair (ex: 1-3, 5, 8-10)</label>
                      <input
                        type="text"
                        value={pdfPageRange}
                        onChange={(e) => setPdfPageRange(e.target.value)}
                        placeholder="1-3, 5"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30"
                      />
                    </div>
                  )}

                  {pdfSplitFile && pdfPageRange && (
                    <button
                      onClick={handlePdfSplit}
                      disabled={isProcessingPdf}
                      className="w-full py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 shadow-xl shadow-white/10"
                    >
                      {isProcessingPdf ? "Processando..." : "Cortar PDF Agora"}
                    </button>
                  )}
                </div>
              )}

              {/* Result and Status */}
              {isProcessingPdf && (
                <div className="mt-8 text-center animate-fade-in">
                  <div className="text-2xl font-bold text-white mb-2">Processando PDF...</div>
                  <p className="text-gray-400">Isso pode levar alguns segundos.</p>
                </div>
              )}

              {activeDocumentTool && pdfResult && !isProcessingPdf && (
                <div className="mt-8 p-6 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-green-400">Pronto!</div>
                      <div className="text-sm text-green-400/70">Seu arquivo foi gerado com sucesso.</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = pdfResult;
                      link.download = activeDocumentTool === 'merge' ? 'merged.pdf' : 'split.pdf';
                      link.click();
                    }}
                    className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Baixar PDF
                  </button>
                </div>
              )}

              {(error || success) && !pdfResult && (
                <div className={`mt-6 p-4 rounded-xl border ${error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                  {error || success}
                </div>
              )}

            </div>
          )}

          {/* UTILS TOOL VIEW - QR CODE */}
          {activeUtilTool === "qr-code" && (
            <div className="animate-fade-in max-w-2xl mx-auto">
              {/* Back button */}
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">voltar</span>
              </button>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-light text-white mb-2 font-display">
                  Gerador de QR Code
                </h2>
                <p className="text-gray-500 font-mono text-sm">
                  crie códigos QR personalizados
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Controls */}
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-mono text-gray-400 mb-2 block uppercase">Conteúdo</label>
                    <input
                      type="text"
                      value={qrText}
                      onChange={(e) => {
                        setQrText(e.target.value);
                        setQrResult(null); // Reset result to force regen if needed, though we will live preview
                      }}
                      placeholder="https://site.com ou texto"
                      className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-emerald-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-mono text-gray-400 mb-2 block uppercase">Cor (Frente)</label>
                      <div className="flex items-center gap-2 bg-dark-800 border border-dark-600 rounded-lg p-2">
                        <input
                          type="color"
                          value={qrColor}
                          onChange={(e) => setQrColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
                        />
                        <span className="text-xs font-mono text-gray-300">{qrColor}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-mono text-gray-400 mb-2 block uppercase">Cor (Fundo)</label>
                      <div className="flex items-center gap-2 bg-dark-800 border border-dark-600 rounded-lg p-2">
                        <input
                          type="color"
                          value={qrBgColor}
                          onChange={(e) => setQrBgColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
                        />
                        <span className="text-xs font-mono text-gray-300">{qrBgColor}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        const url = await QRCode.toDataURL(qrText, {
                          margin: 1,
                          color: {
                            dark: qrColor,
                            light: qrBgColor
                          },
                          width: 1024 // High res for download
                        });
                        setQrResult(url);
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="w-full py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-all shadow-lg shadow-white/5 active:scale-95"
                  >
                    Gerar Código
                  </button>
                </div>

                {/* Preview */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 flex flex-col items-center justified-center min-h-[300px]">
                  {qrResult ? (
                    <div className="flex flex-col items-center animate-fade-in">
                      <img src={qrResult} alt="QR Code" className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg shadow-2xl mb-6" />
                      <div className="flex gap-3 w-full">
                        <button
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = qrResult;
                            a.download = `qrcode_${Date.now()}.png`;
                            a.click();
                          }}
                          className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Baixar PNG
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-500 h-full">
                      <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v1m6 11h2m-6 0h-2v4h2v-4zm-1-8a9 9 0 00-9 9 9 9 0 009 9 9 9 0 009-9 9 9 0 00-9-9z" />
                      </svg>
                      <p className="text-sm font-mono text-center">clique em gerar para visualizar</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}



          {/* UTILS TOOL VIEW - BASE64 */}
          {activeUtilTool === "base64" && (
            <div className="animate-fade-in max-w-2xl mx-auto">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">voltar</span>
              </button>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-light text-white mb-2 font-display">
                  Converter Base64
                </h2>
                <div className="flex justify-center gap-4 mt-4">
                  <button
                    onClick={() => { setBase64Mode("encode"); setBase64Input(""); setBase64Output(""); }}
                    className={`px-4 py-2 rounded-lg font-mono text-xs transition-colors ${base64Mode === "encode" ? "bg-indigo-500 text-white" : "bg-dark-800 text-gray-500 hover:text-white"}`}
                  >
                    ENCODE (Texto → Base64)
                  </button>
                  <button
                    onClick={() => { setBase64Mode("decode"); setBase64Input(""); setBase64Output(""); }}
                    className={`px-4 py-2 rounded-lg font-mono text-xs transition-colors ${base64Mode === "decode" ? "bg-indigo-500 text-white" : "bg-dark-800 text-gray-500 hover:text-white"}`}
                  >
                    DECODE (Base64 → Texto)
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-xs font-mono text-gray-400 mb-2 block uppercase">Entrada</label>
                  <textarea
                    value={base64Input}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBase64Input(val);
                      try {
                        if (!val) {
                          setBase64Output("");
                          return;
                        }
                        if (base64Mode === "encode") {
                          // UTF-8 safe encode
                          setBase64Output(btoa(unescape(encodeURIComponent(val))));
                        } else {
                          // UTF-8 safe decode
                          setBase64Output(decodeURIComponent(escape(atob(val))));
                        }
                        setError(null);
                      } catch (err) {
                        setBase64Output("");
                        // Don't show error immediately on typing, maybe just red border? 
                        // actually let's just clear output
                      }
                    }}
                    placeholder={base64Mode === "encode" ? "Digite o texto para codificar..." : "Cole o código Base64 para decodificar..."}
                    className="w-full h-32 bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none transition-colors font-mono text-sm resize-none"
                  />
                </div>

                <div className="flex justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                <div>
                  <label className="text-xs font-mono text-gray-400 mb-2 block uppercase">Resultado</label>
                  <textarea
                    readOnly
                    value={base64Output}
                    onClick={(e) => {
                      if (base64Output) {
                        navigator.clipboard.writeText(base64Output);
                        setSuccess("Copiado!");
                        setTimeout(() => setSuccess(null), 2000);
                        (e.target as HTMLTextAreaElement).select();
                      }
                    }}
                    placeholder="O resultado aparecerá aqui..."
                    className="w-full h-32 bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-emerald-400 focus:outline-none font-mono text-sm resize-none cursor-pointer hover:border-indigo-500/50 transition-colors"
                  />
                  <p className="text-right text-xs text-gray-500 mt-1">clique para copiar</p>
                </div>
              </div>
            </div>
          )}

          {/* COLOR PALETTE EXTRACTOR VIEW */}
          {activeUtilTool === "color-palette" && (
            <div className="animate-fade-in max-w-2xl mx-auto">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">voltar</span>
              </button>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-light text-white mb-2 font-display">
                  Extrair Paleta de Cores
                </h2>
                <p className="text-gray-500 font-mono text-sm">
                  upload de imagem para extrair cores dominantes
                </p>
              </div>

              <div className="space-y-6">
                {/* Image Upload */}
                <div
                  onClick={() => document.getElementById('palette-image-input')?.click()}
                  className="border-2 border-dashed border-dark-600 rounded-xl p-8 text-center cursor-pointer hover:border-rose-500/50 transition-colors"
                >
                  <input
                    id="palette-image-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string;
                        setPaletteImage(dataUrl);

                        // Extract colors
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;

                          canvas.width = 100;
                          canvas.height = 100;
                          ctx.drawImage(img, 0, 0, 100, 100);

                          const imageData = ctx.getImageData(0, 0, 100, 100).data;
                          const colorMap: { [key: string]: number } = {};

                          for (let i = 0; i < imageData.length; i += 4) {
                            const r = Math.round(imageData[i] / 32) * 32;
                            const g = Math.round(imageData[i + 1] / 32) * 32;
                            const b = Math.round(imageData[i + 2] / 32) * 32;
                            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                            colorMap[hex] = (colorMap[hex] || 0) + 1;
                          }

                          const sorted = Object.entries(colorMap)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 8)
                            .map(([color]) => color);

                          setExtractedColors(sorted);
                        };
                        img.src = dataUrl;
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {paletteImage ? (
                    <img src={paletteImage} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                  ) : (
                    <div className="text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">clique para carregar imagem</p>
                    </div>
                  )}
                </div>

                {/* Extracted Colors */}
                {extractedColors.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-xs font-mono text-gray-400 uppercase">Cores Extraídas (clique para copiar)</p>
                    <div className="grid grid-cols-4 gap-3">
                      {extractedColors.map((color, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            navigator.clipboard.writeText(color);
                            setSuccess(`${color} copiado!`);
                            setTimeout(() => setSuccess(null), 2000);
                          }}
                          className="group flex flex-col items-center gap-2 p-3 bg-dark-800 rounded-xl hover:bg-dark-700 transition-colors"
                        >
                          <div
                            className="w-12 h-12 rounded-lg shadow-lg"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs font-mono text-gray-400 group-hover:text-white transition-colors">
                            {color}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {success && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm text-center">
                    {success}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* COLOR PICKER VIEW - EYEDROPPER */}
          {activeUtilTool === "color-picker" && (
            <div className="animate-fade-in max-w-2xl mx-auto">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">voltar</span>
              </button>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-light text-white mb-2 font-display">
                  Conta-Gotas
                </h2>
                <p className="text-gray-500 font-mono text-sm">
                  clique na imagem para capturar a cor
                </p>
              </div>

              <div className="space-y-6">
                {/* Image Upload */}
                {!pickerImage ? (
                  <div
                    onClick={() => document.getElementById('picker-image-input')?.click()}
                    className="border-2 border-dashed border-dark-600 rounded-xl p-12 text-center cursor-pointer hover:border-violet-500/50 transition-colors"
                  >
                    <input
                      id="picker-image-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setPickerImage(ev.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-500 text-sm">clique para carregar imagem</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Clickable Image with Magnifier */}
                    <div className="relative">
                      <img
                        id="picker-main-image"
                        src={pickerImage}
                        alt="Pick color"
                        className="w-full rounded-xl cursor-none"
                        onMouseMove={(e) => {
                          const img = e.currentTarget;
                          const rect = img.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const y = e.clientY - rect.top;

                          setMagnifierPos({ x: e.clientX, y: e.clientY, show: true });

                          // Get color under cursor
                          const canvas = document.createElement('canvas');
                          canvas.width = img.naturalWidth;
                          canvas.height = img.naturalHeight;
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;

                          const tempImg = new Image();
                          tempImg.onload = () => {
                            ctx.drawImage(tempImg, 0, 0);
                            const scaleX = img.naturalWidth / rect.width;
                            const scaleY = img.naturalHeight / rect.height;
                            const pixelX = Math.floor(x * scaleX);
                            const pixelY = Math.floor(y * scaleY);
                            const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
                            const hex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`;
                            setHoverColor(hex);
                          };
                          tempImg.src = pickerImage;
                        }}
                        onMouseLeave={() => setMagnifierPos(prev => ({ ...prev, show: false }))}
                        onClick={(e) => {
                          const img = e.currentTarget;
                          const rect = img.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const y = e.clientY - rect.top;

                          const canvas = document.createElement('canvas');
                          canvas.width = img.naturalWidth;
                          canvas.height = img.naturalHeight;
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;

                          const tempImg = new Image();
                          tempImg.onload = () => {
                            ctx.drawImage(tempImg, 0, 0);
                            const scaleX = img.naturalWidth / rect.width;
                            const scaleY = img.naturalHeight / rect.height;
                            const pixelX = Math.floor(x * scaleX);
                            const pixelY = Math.floor(y * scaleY);
                            const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
                            const hex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`;
                            setPickerColor(hex);
                            setSuccess(`Cor capturada: ${hex.toUpperCase()}`);
                            setTimeout(() => setSuccess(null), 2000);
                          };
                          tempImg.src = pickerImage;
                        }}
                      />

                      {/* Magnifier Lens */}
                      {magnifierPos.show && (
                        <div
                          className="fixed pointer-events-none z-50 w-32 h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden"
                          style={{
                            left: magnifierPos.x + 20,
                            top: magnifierPos.y - 70,
                            backgroundImage: `url(${pickerImage})`,
                            backgroundPosition: `${-((magnifierPos.x - (document.getElementById('picker-main-image')?.getBoundingClientRect().left || 0)) * 3 - 64)}px ${-((magnifierPos.y - (document.getElementById('picker-main-image')?.getBoundingClientRect().top || 0)) * 3 - 64)}px`,
                            backgroundSize: `${(document.getElementById('picker-main-image')?.offsetWidth || 300) * 3}px ${(document.getElementById('picker-main-image')?.offsetHeight || 200) * 3}px`,
                            imageRendering: 'pixelated'
                          }}
                        >
                          {/* Crosshair */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-full h-0.5 bg-white/50 absolute" />
                            <div className="h-full w-0.5 bg-white/50 absolute" />
                          </div>
                        </div>
                      )}

                      {/* Hover Color Preview */}
                      {magnifierPos.show && (
                        <div
                          className="fixed pointer-events-none z-50 px-3 py-1.5 rounded-lg text-xs font-mono shadow-lg"
                          style={{
                            left: magnifierPos.x + 20,
                            top: magnifierPos.y + 70,
                            backgroundColor: hoverColor,
                            color: parseInt(hoverColor.slice(1), 16) > 0x7fffff ? '#000' : '#fff'
                          }}
                        >
                          {hoverColor.toUpperCase()}
                        </div>
                      )}

                      <button
                        onClick={() => setPickerImage(null)}
                        className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Color Preview */}
                    <div className="flex items-center gap-4 p-4 bg-dark-800 rounded-xl">
                      <div
                        className="w-16 h-16 rounded-lg shadow-lg flex-shrink-0"
                        style={{ backgroundColor: pickerColor }}
                      />
                      <div className="flex-1 space-y-1">
                        <p className="text-white font-mono text-lg">{pickerColor.toUpperCase()}</p>
                        <p className="text-gray-500 font-mono text-xs">
                          RGB: {parseInt(pickerColor.slice(1, 3), 16)}, {parseInt(pickerColor.slice(3, 5), 16)}, {parseInt(pickerColor.slice(5, 7), 16)}
                        </p>
                      </div>
                    </div>

                    {/* Copy Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(pickerColor.toUpperCase());
                          setSuccess("HEX copiado!");
                          setTimeout(() => setSuccess(null), 2000);
                        }}
                        className="py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-mono text-sm transition-colors"
                      >
                        Copiar HEX
                      </button>
                      <button
                        onClick={() => {
                          const rgb = `rgb(${parseInt(pickerColor.slice(1, 3), 16)}, ${parseInt(pickerColor.slice(3, 5), 16)}, ${parseInt(pickerColor.slice(5, 7), 16)})`;
                          navigator.clipboard.writeText(rgb);
                          setSuccess("RGB copiado!");
                          setTimeout(() => setSuccess(null), 2000);
                        }}
                        className="py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-mono text-sm transition-colors"
                      >
                        Copiar RGB
                      </button>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm text-center">
                    {success}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* EXIF VIEWER/REMOVER VIEW */}
          {activeUtilTool === "exif" && (
            <div className="animate-fade-in max-w-2xl mx-auto">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">voltar</span>
              </button>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-light text-white mb-2 font-display">
                  Ver EXIF e Remover
                </h2>
                <p className="text-gray-500 font-mono text-sm">
                  visualize e remova metadados de imagens
                </p>
              </div>

              <div className="space-y-6">
                {/* Image Upload */}
                <div
                  onClick={() => document.getElementById('exif-image-input')?.click()}
                  className="border-2 border-dashed border-dark-600 rounded-xl p-8 text-center cursor-pointer hover:border-amber-500/50 transition-colors"
                >
                  <input
                    id="exif-image-input"
                    type="file"
                    accept="image/jpeg,image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const reader = new FileReader();
                      reader.onload = async (ev) => {
                        const dataUrl = ev.target?.result as string;
                        setExifImage(dataUrl);
                        setCleanedImage(null);

                        // Parse EXIF data
                        try {
                          const arrayBuffer = await file.arrayBuffer();
                          const view = new DataView(arrayBuffer);

                          // Check if JPEG
                          if (view.getUint16(0) !== 0xFFD8) {
                            setExifData({ "Erro": "Não é um arquivo JPEG válido" });
                            return;
                          }

                          const metadata: { [key: string]: string } = {};
                          metadata["Nome"] = file.name;
                          metadata["Tamanho"] = `${(file.size / 1024).toFixed(1)} KB`;
                          metadata["Tipo"] = file.type;
                          metadata["Última Modificação"] = new Date(file.lastModified).toLocaleString("pt-BR");

                          // Simple EXIF search - find APP1 marker
                          let offset = 2;
                          while (offset < view.byteLength - 2) {
                            const marker = view.getUint16(offset);
                            if (marker === 0xFFE1) { // APP1 (EXIF)
                              metadata["EXIF"] = "Presente";
                              const length = view.getUint16(offset + 2);
                              metadata["Tamanho EXIF"] = `${length} bytes`;
                              break;
                            } else if ((marker & 0xFFE0) === 0xFFE0) {
                              const length = view.getUint16(offset + 2);
                              offset += 2 + length;
                            } else {
                              break;
                            }
                          }

                          if (!metadata["EXIF"]) {
                            metadata["EXIF"] = "Não encontrado";
                          }

                          setExifData(metadata);
                        } catch (err) {
                          console.error(err);
                          setExifData({ "Erro": "Falha ao ler metadados" });
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {exifImage ? (
                    <img src={exifImage} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                  ) : (
                    <div className="text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">clique para carregar imagem JPEG</p>
                    </div>
                  )}
                </div>

                {/* EXIF Data Display */}
                {exifData && (
                  <div className="bg-dark-800 rounded-xl p-6 space-y-3">
                    <p className="text-xs font-mono text-gray-400 uppercase mb-4">Metadados Encontrados</p>
                    {Object.entries(exifData).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center py-2 border-b border-dark-700 last:border-0">
                        <span className="text-gray-400 text-sm">{key}</span>
                        <span className="text-white font-mono text-sm">{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {exifImage && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        // Remove EXIF by drawing to canvas
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          canvas.width = img.width;
                          canvas.height = img.height;
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;
                          ctx.drawImage(img, 0, 0);
                          const cleanUrl = canvas.toDataURL('image/jpeg', 0.95);
                          setCleanedImage(cleanUrl);
                          setSuccess("EXIF removido com sucesso!");
                          setTimeout(() => setSuccess(null), 3000);
                        };
                        img.src = exifImage;
                      }}
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl transition-colors"
                    >
                      Remover EXIF
                    </button>

                    {cleanedImage && (
                      <button
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = cleanedImage;
                          a.download = `clean_${Date.now()}.jpg`;
                          a.click();
                        }}
                        className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Baixar Limpa
                      </button>
                    )}
                  </div>
                )}

                {success && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm text-center">
                    {success}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIDEO TOOL VIEW */}
          {activeVideoTool && (
            <>
              {/* Back button */}
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">voltar</span>
              </button>

              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-xl font-light text-white mb-1 font-display">
                  {activeVideoTool === "extract-frame" ? "Extrair Frame" :
                    activeVideoTool === "trim" ? "Cortar Vídeo" :
                      activeVideoTool === "to-gif" ? "Vídeo para GIF" : "Remover Áudio"}
                </h2>
                <p className="text-gray-600 text-sm font-mono">
                  {activeVideoTool === "extract-frame" ? "salvar imagem do vídeo" :
                    activeVideoTool === "trim" ? "escolha o trecho" :
                      activeVideoTool === "to-gif" ? "criar gif animado" : "remove trilha sonora"}
                </p>
              </div>

              {/* Hidden file input */}
              <input
                ref={videoToolInputRef}
                type="file"
                accept=".mp4,.mkv,.webm,.mov"
                onChange={handleVideoToolFileSelect}
                className="hidden"
              />

              {/* File drop zone */}
              {!videoToolFile && (
                <div
                  onClick={() => videoToolInputRef.current?.click()}
                  className="border-2 border-dashed border-dark-600 rounded-xl p-12 text-center cursor-pointer hover:border-dark-500 transition-colors"
                >
                  <svg className="w-12 h-12 mx-auto text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-400 text-sm mb-1">clique para selecionar vídeo</p>
                  <p className="text-gray-600 text-xs font-mono">MP4, MKV, MOV</p>
                </div>
              )}

              {/* Tool Interface */}
              {videoToolFile && (
                <div className="space-y-6">
                  {/* Video Preview */}
                  <div className="bg-dark-800 rounded-xl p-4">
                    <video
                      ref={videoPreviewRef}
                      src={videoUrl || ""}
                      controls
                      className="w-full max-h-[400px] mb-4 rounded-lg bg-black"
                    />

                    {/* Controls per tool */}
                    <div className="grid grid-cols-1 gap-4 p-4 bg-dark-900 rounded-lg">
                      {activeVideoTool === 'extract-frame' && (
                        <div>
                          <label className="text-white text-sm mb-2 block">Tempo do Frame (segundos)</label>
                          <div className="flex items-center gap-4">
                            <input
                              type="range"
                              min="0"
                              max={videoDuration || 100}
                              step="0.1"
                              value={frameTime}
                              onChange={(e) => {
                                const t = parseFloat(e.target.value);
                                setFrameTime(t);
                                if (videoPreviewRef.current) videoPreviewRef.current.currentTime = t;
                              }}
                              className="flex-1 h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <span className="text-white font-mono w-16 text-right">{frameTime.toFixed(1)}s</span>
                          </div>
                        </div>
                      )}

                      {(activeVideoTool === 'trim' || activeVideoTool === 'to-gif') && (
                        <>
                          <div>
                            <label className="text-white text-sm mb-2 block">Início (segundos)</label>
                            <div className="flex items-center gap-4">
                              <input
                                type="range"
                                min="0"
                                max={videoDuration || 100}
                                step="0.1"
                                value={trimStart}
                                onChange={(e) => {
                                  const t = parseFloat(e.target.value);
                                  setTrimStart(t);
                                  if (videoPreviewRef.current) videoPreviewRef.current.currentTime = t;
                                }}
                                className="flex-1 h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                              />
                              <span className="text-white font-mono w-16 text-right">{trimStart.toFixed(1)}s</span>
                            </div>
                          </div>
                          <div>
                            <label className="text-white text-sm mb-2 block">Fim (segundos)</label>
                            <div className="flex items-center gap-4">
                              <input
                                type="range"
                                min="0"
                                max={videoDuration || 100}
                                step="0.1"
                                value={trimEnd}
                                onChange={(e) => {
                                  const t = parseFloat(e.target.value);
                                  setTrimEnd(t);
                                  if (videoPreviewRef.current) videoPreviewRef.current.currentTime = t;
                                }}
                                className="flex-1 h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                              />
                              <span className="text-white font-mono w-16 text-right">{trimEnd.toFixed(1)}s</span>
                            </div>
                            <p className="text-gray-500 text-xs mt-1 text-right">Duração: {(trimEnd - trimStart).toFixed(1)}s</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Result Preview if available */}
                  {videoToolResult && (
                    <div className="bg-dark-800 rounded-xl p-4 border border-green-500/30">
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-green-400 text-xs font-mono uppercase">Resultado Pronto</p>
                        <button
                          onClick={handleDownloadVideoResult}
                          className="px-3 py-1 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg text-xs font-mono transition-colors flex items-center gap-2"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          baixar agora
                        </button>
                      </div>

                      {activeVideoTool === 'to-gif' ? (
                        <img src={videoToolResult} className="w-full max-h-[300px] object-contain rounded-lg bg-black/50" />
                      ) : (
                        <video src={videoToolResult} controls className="w-full max-h-[300px] rounded-lg bg-black" />
                      )}

                      <div className="mt-4">
                        <button
                          onClick={handleDownloadVideoResult}
                          className="w-full py-3 bg-white text-black rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors flex justify-center items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Baixar Resultado
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setVideoToolFile(null);
                        setVideoToolResult(null);
                        setSuccess(null);
                      }}
                      className="px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-gray-400 hover:text-white transition-colors text-sm"
                    >
                      escolher outro
                    </button>

                    {!videoToolResult ? (
                      <button
                        onClick={handleVideoToolProcess}
                        disabled={isProcessingVideo}
                        className="flex-1 py-3 bg-white text-black rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                      >
                        {isProcessingVideo ? (
                          <>
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            <span>{videoToolStatus || `processando (${videoToolProgress}%)`}</span>
                          </>
                        ) : (
                          "Processar Vídeo"
                        )}
                      </button>
                    ) : (
                      // Button removed from here as it is now inside the result card
                      null
                    )}
                  </div>

                  {/* Error message */}
                  {error && (
                    <div className="p-3 bg-dark-800 border border-dark-600 rounded-lg text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  {/* Success message */}
                  {success && (
                    <div className="p-3 bg-dark-800 border border-dark-600 rounded-lg text-green-400 text-sm">
                      {success}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* CONVERSION VIEW (after selecting preset or custom) */}
          {!showPresetGrid && !activeImageTool && !activeVideoTool && !activeAudioTool && !activeDocumentTool && !activeUtilTool && (
            <>
              {/* Back button */}
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                voltar
              </button>

              {/* Title */}
              <div className="text-center mb-4">
                {selectedPreset ? (
                  <>
                    <h2 className="text-xl font-light text-white mb-1 font-display">
                      {selectedPreset.name}
                    </h2>
                    <p className="text-gray-600 text-sm font-mono">
                      {selectedPreset.description}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-600 text-lg font-light tracking-wide font-display">
                      {category === "media" && "converta vídeos e áudios"}
                      {category === "image" && "converta suas imagens"}
                      {category === "document" && "converta imagens para PDF"}
                    </p>
                  </>
                )}
                {!platform.isTauri && category === "media" && (
                  <p className="text-gray-700 text-xs mt-2 font-mono">
                    processamento local no seu navegador
                  </p>
                )}
              </div>

              {/* Category tabs (only in custom mode) */}
              {isCustomMode && (
                <div className="flex justify-center gap-2 mb-6">
                  {[
                    { id: "media" as const, label: "mídia", icon: <MediaIcon className="w-5 h-5" /> },
                    { id: "image" as const, label: "imagem", icon: <ImageIcon className="w-5 h-5" /> },
                    { id: "document" as const, label: "documento", icon: <DocumentIcon className="w-5 h-5" /> },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryChange(cat.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${category === cat.id
                        ? "bg-white text-black"
                        : "bg-dark-800 text-gray-400 hover:text-white border border-dark-700"
                        }`}
                    >
                      {cat.icon}
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleSelectFile}
                className={`
                  relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
                  ${isDragging
                    ? "border-white bg-dark-800"
                    : "border-dark-600 hover:border-dark-500 bg-dark-900"
                  }
                  ${hasFile ? "border-solid" : ""}
                `}
              >
                {hasFile ? (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-dark-800 rounded-xl flex items-center justify-center">
                      {category === "media" && <MediaIcon className="w-8 h-8 text-white" />}
                      {category === "image" && <ImageIcon className="w-8 h-8 text-white" />}
                      {category === "document" && <DocumentIcon className="w-8 h-8 text-white" />}
                    </div>
                    <p className="text-white font-medium truncate max-w-full">{fileName}</p>
                    {selectedFile && (
                      <p className="text-xs text-gray-600 font-mono">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClear();
                      }}
                      className="text-xs text-gray-500 hover:text-white transition-colors"
                    >
                      remover arquivo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-dark-800 rounded-xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">
                        {platform.isTauri ? "clique para selecionar" : "arraste ou clique para selecionar"}
                      </p>
                      <p className="text-gray-600 text-xs mt-1 font-mono">
                        {getAcceptString().replace(/\./g, "").toUpperCase().replace(/,/g, ", ")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Output Format (only in custom mode or if file selected) */}
              {hasFile && isCustomMode && (
                <div className="space-y-4 animate-fade-in">
                  <p className="text-xs text-gray-500 font-mono tracking-wider">CONVERTER PARA</p>
                  <div className="flex flex-wrap gap-2">
                    {currentFormats.map((format) => (
                      <button
                        key={format.id}
                        onClick={() => setOutputFormat(format.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-mono transition-all ${outputFormat === format.id
                          ? "bg-white text-black"
                          : "bg-dark-800 text-gray-400 hover:text-white border border-dark-700"
                          }`}
                      >
                        {format.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress */}
              {isConverting && (
                <div className="space-y-2 animate-fade-in">
                  <div className="h-1 bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 font-mono text-center tracking-wider">
                    {isLoadingFFmpeg ? "CARREGANDO FFMPEG..." : "CONVERTENDO..."}
                  </p>
                </div>
              )}

              {/* Convert Button */}
              {hasFile && !isConverting && (
                <button
                  onClick={handleConvert}
                  disabled={isConverting}
                  className="w-full py-4 bg-white text-black rounded-xl font-semibold hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  converter para {outputFormat.toUpperCase()}
                </button>
              )}

              {/* Error */}
              {error && (
                <div className="p-4 bg-dark-800 border border-dark-600 rounded-lg text-gray-400 text-sm animate-fade-in">
                  <p>{error}</p>
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="p-4 bg-dark-800 border border-dark-600 rounded-lg animate-fade-in">
                  <p className="flex items-center gap-2 text-white text-sm mb-3">
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {success}
                  </p>

                  {conversionResult && (
                    <button
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = conversionResult.url;
                        a.download = conversionResult.filename;
                        a.click();
                      }}
                      className="w-full py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-xs font-mono transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      baixar novamente
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PresetIcon({ type, className, style }: { type: string; className?: string; style?: React.CSSProperties }) {
  switch (type) {
    case "audio":
      return (
        <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      );
    case "video":
      return <MediaIcon className={className} style={style} />;
    case "image":
      return <ImageIcon className={className} style={style} />;
    case "speech":
      return (
        <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      );
    default:
      return (
        <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      );
  }
}

function MediaIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function ImageIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function DocumentIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
