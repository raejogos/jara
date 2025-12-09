import { useState, useEffect, useMemo } from "react";
import { platform } from "../services/api";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  onBatchSubmit?: (urls: string[]) => void;
  isLoading: boolean;
  error: string | null;
}

const slogans = [
  "baixa isso aí rapidinho",
  "salva antes que suma",
  "offline é o novo online",
  "guarda pra ver depois",
  "backup nunca é demais",
  "colecione memórias",
  "eu vou fazer uma oferta irrecusável",
  "houston, temos um download",
  "que a força esteja com você",
  "eu voltarei... com seu arquivo",
  "elementar, meu caro usuário",
  "rápido e certeiro",
  "missão: download",
  "do jeito que tem que ser",
  "na velocidade da luz",
];

const loadingMessages = [
  "buscando informações",
  "quase lá",
  "processando",
  "só mais um segundo",
  "carregando metadados",
  "analisando formatos",
  "preparando opções",
  "conectando",
];

// Check if URL is from YouTube
function isYouTubeUrl(url: string): boolean {
  const ytPatterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com/i,
    /^(https?:\/\/)?(www\.)?youtu\.be/i,
    /^(https?:\/\/)?(music\.)?youtube\.com/i,
    /^(https?:\/\/)?m\.youtube\.com/i,
  ];
  return ytPatterns.some(pattern => pattern.test(url));
}

// Check if user is on mobile
function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function UrlInput({ onSubmit, onBatchSubmit, isLoading, error }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [youtubeWarning, setYoutubeWarning] = useState<string | null>(null);

  // Random slogan on mount
  const slogan = useMemo(() => {
    return slogans[Math.floor(Math.random() * slogans.length)];
  }, []);

  // Cycle through loading messages
  useEffect(() => {
    if (!isLoading) {
      setLoadingMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Parse batch URLs and count valid ones
  const parsedUrls = useMemo(() => {
    return batchUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && (u.startsWith("http://") || u.startsWith("https://")));
  }, [batchUrls]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setYoutubeWarning(null);

    if (isBatchMode) {
      // Batch mode
      if (parsedUrls.length === 0) return;

      // Check for YouTube URLs in web mode
      if (platform.isWeb) {
        const hasYoutube = parsedUrls.some(isYouTubeUrl);
        if (hasYoutube) {
          if (isMobile()) {
            setYoutubeWarning("downloads do YouTube não estão disponíveis no celular. remova os links do YouTube ou baixe o app desktop.");
          } else {
            setYoutubeWarning("alguns links são do YouTube. para baixá-los, use o app desktop. os outros links funcionam normalmente.");
          }
          return;
        }
      }

      if (onBatchSubmit) {
        onBatchSubmit(parsedUrls);
      }
    } else {
      // Single URL mode
      const trimmedUrl = url.trim();
      if (!trimmedUrl) return;

      // Check YouTube restriction for web users
      if (platform.isWeb && isYouTubeUrl(trimmedUrl)) {
        if (isMobile()) {
          setYoutubeWarning("downloads do YouTube não estão disponíveis no celular. acesse pelo computador ou baixe o app desktop.");
        } else {
          setYoutubeWarning("para baixar do YouTube, baixe o app desktop do Jara. outros sites funcionam normalmente aqui.");
        }
        return;
      }

      onSubmit(trimmedUrl);
    }
  };

  return (
    <div>
      {/* Slogan */}
      <p className="text-center text-gray-600 text-lg font-light tracking-wide mb-8 animate-fade-in font-display">
        {slogan}
      </p>

      {/* Mode Toggle */}
      {onBatchSubmit && (
        <div className="flex justify-center mb-4">
          <div className="inline-flex bg-dark-900 border border-dark-700 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setIsBatchMode(false)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                !isBatchMode
                  ? "bg-dark-700 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              URL única
            </button>
            <button
              type="button"
              onClick={() => setIsBatchMode(true)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                isBatchMode
                  ? "bg-dark-700 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              lote
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={isBatchMode ? "space-y-3" : "flex gap-3"}>
        {isBatchMode ? (
          <>
            <div className="relative">
              <textarea
                value={batchUrls}
                onChange={(e) => {
                  setBatchUrls(e.target.value);
                  setYoutubeWarning(null);
                }}
                placeholder="cole os links aqui (um por linha)"
                rows={6}
                className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-4 text-white placeholder-gray-600 focus:border-dark-400 focus:bg-dark-800 transition-all font-mono text-sm resize-none"
                disabled={isLoading}
              />
              {parsedUrls.length > 0 && (
                <span className="absolute bottom-3 right-3 text-xs text-gray-500 font-mono">
                  {parsedUrls.length} {parsedUrls.length === 1 ? "link" : "links"}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading || parsedUrls.length === 0}
              className="w-full py-4 bg-dark-800 border border-dark-600 hover:bg-dark-700 rounded-xl transition-all flex items-center justify-center gap-2 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="text-sm font-medium">
                adicionar {parsedUrls.length > 0 ? parsedUrls.length : ""} à fila
              </span>
            </button>
          </>
        ) : (
          <>
            <div className="flex-1 relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setYoutubeWarning(null);
                }}
                placeholder="cole o link aqui"
                className="w-full bg-dark-900 border border-dark-600 rounded-xl pl-12 pr-4 py-4 text-white placeholder-gray-600 focus:border-dark-400 focus:bg-dark-800 transition-all font-mono text-sm"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="px-6 py-4 bg-dark-800 border border-dark-600 hover:bg-dark-700 rounded-xl transition-all flex items-center gap-2 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span className="text-sm font-medium">buscar</span>
            </button>
          </>
        )}
      </form>

      {isLoading && (
        <div className="flex items-center justify-center gap-3 mt-6 text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-wider uppercase">{loadingMessages[loadingMessageIndex]}</span>
        </div>
      )}

      {youtubeWarning && (
        <div className="mt-4 p-4 bg-dark-800 border border-dark-600 rounded-lg animate-fade-in">
          <p className="text-gray-300 text-sm mb-3">{youtubeWarning}</p>
          {!isMobile() && (
            <a
              href="https://github.com/raejogos/jara/releases/download/v1.1.0/Jara_1.1.0_x64-setup.exe"
              className="inline-flex items-center gap-2 text-xs text-white bg-dark-700 hover:bg-dark-600 px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              baixar app desktop
            </a>
          )}
        </div>
      )}

      {error && !youtubeWarning && (
        <div className="mt-4 p-4 bg-dark-800 border border-dark-600 rounded-lg text-gray-400 text-sm">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
