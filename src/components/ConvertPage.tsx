import { useState, useCallback, useRef } from "react";
import { platform } from "../services/api";
import { convertFile, downloadBlob } from "../services/converter";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

type ConvertCategory = "media" | "image" | "document";

interface ConvertOption {
  id: string;
  label: string;
  extensions: string[];
}

interface QuickPreset {
  id: string;
  name: string;
  description: string;
  icon: "audio" | "video" | "image" | "document" | "custom";
  inputExtensions: string[];
  outputFormat: string;
  category: ConvertCategory;
  color: string;
}

const quickPresets: QuickPreset[] = [
  {
    id: "webp-to-png",
    name: "WEBP → PNG",
    description: "formato universal",
    icon: "image",
    inputExtensions: ["webp"],
    outputFormat: "png",
    category: "image",
    color: "#fbbf24", // amber
  },
  {
    id: "video-to-mp3",
    name: "Extrair Áudio",
    description: "MP4, MKV → MP3",
    icon: "audio",
    inputExtensions: ["mp4", "mkv", "webm", "avi", "mov"],
    outputFormat: "mp3",
    category: "media",
    color: "#f472b6", // pink
  },
  {
    id: "image-to-pdf",
    name: "Imagem → PDF",
    description: "JPG, PNG → PDF",
    icon: "document",
    inputExtensions: ["jpg", "jpeg", "png", "webp", "bmp"],
    outputFormat: "pdf",
    category: "document",
    color: "#f87171", // red
  },
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

export function ConvertPage() {
  const [selectedPreset, setSelectedPreset] = useState<QuickPreset | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [category, setCategory] = useState<ConvertCategory>("media");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState("mp3");
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFFmpeg, setIsLoadingFFmpeg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image tools state
  const [activeImageTool, setActiveImageTool] = useState<"remove-bg" | "compress" | null>(null);
  const [imageToolFile, setImageToolFile] = useState<File | null>(null);
  const [imageToolResult, setImageToolResult] = useState<string | null>(null);
  const [imageToolProgress, setImageToolProgress] = useState(0);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string | null>(null);
  const imageToolInputRef = useRef<HTMLInputElement>(null);

  // Background removal options
  const [bgRemovalModel, setBgRemovalModel] = useState<"isnet_fp16" | "isnet_quint8">("isnet_fp16");
  const [bgRemovalQuality, setBgRemovalQuality] = useState(0.8);

  // Video tools state
  const [activeVideoTool, setActiveVideoTool] = useState<"extract-frame" | "trim" | "to-gif" | "remove-audio" | null>(null);
  const [videoToolFile, setVideoToolFile] = useState<File | null>(null);
  const [videoToolResult, setVideoToolResult] = useState<string | null>(null);
  const [videoToolProgress, setVideoToolProgress] = useState(0);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const videoToolInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Video tool options
  const [frameTime, setFrameTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(10);
  const [videoDuration, setVideoDuration] = useState(0);

  const handlePresetSelect = (preset: QuickPreset) => {
    setSelectedPreset(preset);
    setIsCustomMode(false);
    setCategory(preset.category);
    setOutputFormat(preset.outputFormat);
    setError(null);
    setSuccess(null);
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
    // Also reset video tools
    setActiveVideoTool(null);
    setVideoToolFile(null);
    setVideoToolResult(null);
    setVideoToolProgress(0);
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
    setOutputFormat(formatsByCategory[newCategory][0].id);
  };

  // Image tools handlers
  const handleImageToolSelect = (tool: "remove-bg" | "compress") => {
    setActiveImageTool(tool);
    setImageToolFile(null);
    setImageToolResult(null);
    setError(null);
    setSuccess(null);
    setImageToolProgress(0);
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
        const { removeBackground } = await import("@imgly/background-removal");
        setImageToolProgress(30);

        const blob = await removeBackground(imageToolFile, {
          model: bgRemovalModel,
          output: {
            format: "image/png",
            quality: bgRemovalQuality,
          },
          progress: (_key, current, total) => {
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

  // Stable video URL to prevent re-renders
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Video Tools Logic
  const handleVideoToolSelect = (tool: "extract-frame" | "trim" | "to-gif" | "remove-audio") => {
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
    setError(null);

    const ffmpeg = new FFmpeg();

    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      ffmpeg.on('progress', ({ progress }) => {
        const p = Math.round(progress * 100);
        setVideoToolProgress(p);
      });

      ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg Log:', message);
      });

      await ffmpeg.writeFile('input.mp4', await fetchFile(videoToolFile));

      let outputFilename = '';
      let mimeType = '';

      if (activeVideoTool === 'extract-frame') {
        outputFilename = 'frame.png';
        mimeType = 'image/png';
        await ffmpeg.exec([
          '-ss', frameTime.toString(),
          '-i', 'input.mp4',
          '-frames:v', '1',
          outputFilename
        ]);
      }
      else if (activeVideoTool === 'trim') {
        outputFilename = 'trimmed.mp4';
        mimeType = 'video/mp4';
        const duration = trimEnd - trimStart;
        await ffmpeg.exec([
          '-ss', trimStart.toString(),
          '-i', 'input.mp4',
          '-t', duration.toString(),
          '-c', 'copy', // Fast copy without re-encoding
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
      else if (activeVideoTool === 'remove-audio') {
        outputFilename = 'no-audio.mp4';
        mimeType = 'video/mp4';
        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-c', 'copy',
          '-an',
          outputFilename
        ]);
      }

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
    if (activeVideoTool === 'extract-frame') extension = 'png';
    if (activeVideoTool === 'to-gif') extension = 'gif';

    a.download = `jara_${activeVideoTool}_${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getAcceptString = () => {
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

        downloadBlob(blob, filename);
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
    setProgress(0);
  };

  const currentFormats = formatsByCategory[category];
  const fileName = selectedFile?.name || selectedFilePath?.split(/[/\\]/).pop();
  const hasFile = selectedFile || selectedFilePath;
  const showPresetGrid = !selectedPreset && !isCustomMode && !activeImageTool && !activeVideoTool;

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
                        borderColor: `${preset.color}20`,
                      }}
                    >
                      <div
                        className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                        style={{
                          backgroundColor: `${preset.color}20`,
                        }}
                      >
                        <PresetIcon
                          type={preset.icon}
                          className="w-5 h-5 transition-colors"
                          style={{ color: preset.color }}
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
                </div>
              </div>

              {/* VIDEO TOOLS SECTION */}
              <div className="mt-8">
                <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-mono">vídeo</h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* Extract Frame */}
                  <button
                    onClick={() => handleVideoToolSelect("extract-frame")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#3b82f620" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#3b82f620" }}
                    >
                      <svg className="w-5 h-5" style={{ color: "#3b82f6" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Extrair Frame</p>
                    <p className="text-gray-500 text-xs font-mono">capturar imagem</p>
                  </button>

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

                  {/* Remove Audio */}
                  <button
                    onClick={() => handleVideoToolSelect("remove-audio")}
                    className="group p-4 bg-dark-800 border border-dark-700 rounded-xl hover:border-white/30 hover:bg-dark-700 transition-all text-left"
                    style={{ borderColor: "#f43f5e20" }}
                  >
                    <div
                      className="w-10 h-10 mb-3 rounded-lg flex items-center justify-center transition-colors"
                      style={{ backgroundColor: "#f43f5e20" }}
                    >
                      <svg className="w-5 h-5" style={{ color: "#f43f5e" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" stroke="#f43f5e" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Remover Áudio</p>
                    <p className="text-gray-500 text-xs font-mono">silenciar vídeo</p>
                  </button>
                </div>
              </div>
            </>
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
                  {activeImageTool === "remove-bg" ? "Remover Fundo" : "Comprimir Imagem"}
                </h2>
                <p className="text-gray-600 text-sm font-mono">
                  {activeImageTool === "remove-bg" ? "IA processa localmente" : "reduz o tamanho do arquivo"}
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

              {/* File drop zone */}
              {!imageToolFile && (
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
                      <p className="text-green-400 text-xs mb-2 font-mono uppercase">Resultado Pronto</p>
                      {activeVideoTool === 'extract-frame' || activeVideoTool === 'to-gif' ? (
                        <img src={videoToolResult} className="w-full max-h-[300px] object-contain rounded-lg bg-black/50" />
                      ) : (
                        <video src={videoToolResult} controls className="w-full max-h-[300px] rounded-lg bg-black" />
                      )}
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
                            <span>processando ({videoToolProgress}%)</span>
                          </>
                        ) : (
                          "Processar Vídeo"
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={handleDownloadVideoResult}
                        className="flex-1 py-3 bg-white text-black rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors flex justify-center items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Baixar Resultado
                      </button>
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
          {!showPresetGrid && !activeImageTool && (
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
                <div className="p-4 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm animate-fade-in">
                  <p className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {success}
                  </p>
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
    case "document":
      return <DocumentIcon className={className} style={style} />;
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
