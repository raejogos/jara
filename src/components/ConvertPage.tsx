import { useState, useCallback, useRef } from "react";
import { platform } from "../services/api";
import { convertFile, downloadBlob } from "../services/converter";

type ConvertCategory = "media" | "image" | "document";

interface ConvertOption {
  id: string;
  label: string;
  extensions: string[];
}

const categories: { id: ConvertCategory; label: string; icon: React.ReactNode }[] = [
  { 
    id: "media", 
    label: "mídia",
    icon: <MediaIcon className="w-5 h-5" />
  },
  { 
    id: "image", 
    label: "imagem",
    icon: <ImageIcon className="w-5 h-5" />
  },
  { 
    id: "document", 
    label: "documento",
    icon: <DocumentIcon className="w-5 h-5" />
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

  const handleCategoryChange = (newCategory: ConvertCategory) => {
    setCategory(newCategory);
    setSelectedFile(null);
    setSelectedFilePath(null);
    setError(null);
    setSuccess(null);
    setOutputFormat(formatsByCategory[newCategory][0].id);
  };

  const handleSelectFile = async () => {
    if (platform.isTauri) {
      // Tauri: use native file dialog
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const extensions = acceptByCategory[category].replace(/\./g, "").split(",");
        
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
      // Web: use file input
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
    // Reset input so same file can be selected again
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
        // Tauri: use native commands
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
        // Web: use client-side conversion
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
        
        // Auto download the converted file
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-xl space-y-6">
          
          {/* Hidden file input for web */}
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptByCategory[category]}
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Category Tabs */}
          <div className="flex justify-center gap-2 mb-8">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  category === cat.id
                    ? "bg-white text-black"
                    : "bg-dark-800 text-gray-400 hover:text-white border border-dark-700"
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>

          {/* Title based on category */}
          <div className="text-center mb-4">
            <p className="text-gray-600 text-lg font-light tracking-wide font-display">
              {category === "media" && "converta vídeos e áudios"}
              {category === "image" && "converta suas imagens"}
              {category === "document" && "converta imagens para PDF"}
            </p>
            {!platform.isTauri && category === "media" && (
              <p className="text-gray-700 text-xs mt-2 font-mono">
                processamento local no seu navegador
              </p>
            )}
          </div>

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
                    {acceptByCategory[category].replace(/\./g, "").toUpperCase().replace(/,/g, ", ")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Output Format */}
          {hasFile && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-xs text-gray-500 font-mono tracking-wider">CONVERTER PARA</p>
              <div className="flex flex-wrap gap-2">
                {currentFormats.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => setOutputFormat(format.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-mono transition-all ${
                      outputFormat === format.id
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
        </div>
      </div>
    </div>
  );
}

function MediaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
