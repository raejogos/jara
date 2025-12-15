import { useState, useEffect, useMemo } from "react";
import { platform } from "../services/api";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  onBatchSubmit?: (urls: string[]) => void;
  isLoading: boolean;
  error: string | null;
}

const slogans = [
  "salva antes que suma",
  "offline é o novo online",
  "nada dura pra sempre",
  "antes que seja tarde demais",
  "você sabe o que fazer",
  "não olhe para trás",
  "isso fica entre nós",
  "silêncio. downloads acontecendo",
  "a internet esquece. você não",
  "eles não vão saber",
  "grave enquanto pode",
  "o tempo não espera",
  "sem rastros",
  "você foi avisado",
  "uma vez perdido, perdido pra sempre",
  "confie em mim",
  "isso não é sobre você",
  "ninguém precisa saber",
  "só mais um",
  "a gente finge que não viu",
  "tecnicamente legal",
  "moralmente ambíguo",
  "eticamente questionável",
  "juridicamente cinza",
  "o algoritmo não vai te achar aqui",
  "backup pessoal",
  "arquivamento acadêmico",
  "preservação cultural",
  "fair use provavelmente",
  "a culpa é do yt-dlp",
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

// Detect service from URL for dynamic icon
function detectService(url: string): string | null {
  const lower = url.toLowerCase();
  if (/youtube|youtu\.be/.test(lower)) return "youtube";
  if (/soundcloud/.test(lower)) return "soundcloud";
  if (/tiktok/.test(lower)) return "tiktok";
  if (/spotify/.test(lower)) return "spotify";
  if (/twitter|^x\./.test(lower)) return "twitter";
  if (/instagram/.test(lower)) return "instagram";
  if (/facebook|fb\.watch/.test(lower)) return "facebook";
  if (/twitch/.test(lower)) return "twitch";
  if (/vimeo/.test(lower)) return "vimeo";
  if (/dailymotion/.test(lower)) return "dailymotion";
  if (/reddit/.test(lower)) return "reddit";
  if (/bandcamp/.test(lower)) return "bandcamp";
  if (/pinterest/.test(lower)) return "pinterest";
  return null;
}

// Service icons as SVG paths
const ServiceIcon = ({ service }: { service: string | null }) => {
  if (service === "youtube") {
    return (
      <svg className="w-5 h-5 text-red-500 transition-all" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  if (service === "soundcloud") {
    return (
      <svg className="w-5 h-5 text-orange-500 transition-all" viewBox="0 0 24 24" fill="currentColor">
        <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.01-.06-.052-.1-.084-.1zm-.899 1.552c-.06 0-.091.037-.104.094l-.166 1.61.166 1.564c.013.057.045.094.09.094.051 0 .089-.037.102-.094l.21-1.563-.225-1.611c-.013-.057-.045-.094-.073-.094zm1.83-1.552c-.063 0-.116.053-.127.12l-.195 2.154.195 2.092c.011.065.064.12.127.12.063 0 .116-.055.127-.12l.224-2.093-.224-2.153c-.011-.066-.064-.12-.127-.12zm.912-.49c-.074 0-.135.061-.15.136l-.181 2.644.181 2.537c.015.075.076.136.15.136.076 0 .138-.061.15-.136l.209-2.537-.209-2.644c-.012-.075-.074-.136-.15-.136zm.962-.391c-.086 0-.157.07-.172.156l-.166 3.035.166 2.907c.015.086.086.157.172.157.088 0 .158-.07.173-.157l.188-2.907-.188-3.035c-.015-.086-.085-.156-.173-.156zm.96-.251c-.1 0-.18.082-.195.186l-.151 3.286.151 3.086c.015.104.095.186.195.186.1 0 .18-.082.195-.186l.172-3.086-.172-3.286c-.015-.104-.095-.186-.195-.186zm.958-.24c-.11 0-.198.09-.213.209l-.136 3.526.136 3.206c.015.119.103.21.213.21.11 0 .199-.091.214-.21l.153-3.206-.153-3.526c-.015-.119-.104-.209-.214-.209zm.97-.165c-.12 0-.219.1-.234.226l-.121 3.691.121 3.28c.015.126.114.226.234.226.12 0 .219-.1.234-.226l.136-3.28-.136-3.691c-.015-.126-.114-.226-.234-.226zm.97-.15c-.132 0-.24.11-.256.248l-.106 3.841.106 3.323c.016.138.124.248.256.248.132 0 .24-.11.256-.248l.12-3.323-.12-3.841c-.016-.138-.124-.248-.256-.248zm.97-.12c-.144 0-.261.118-.278.269l-.09 3.961.09 3.33c.017.15.134.268.278.268.143 0 .26-.118.277-.268l.105-3.33-.105-3.961c-.017-.151-.134-.269-.277-.269zm.97-.06c-.155 0-.281.128-.299.29l-.076 4.021.076 3.33c.018.162.144.29.299.29.155 0 .281-.128.299-.29l.09-3.33-.09-4.021c-.018-.162-.144-.29-.299-.29zm3.458.164c-.195 0-.36.057-.51.164-.21-2.37-2.19-4.226-4.62-4.226-.63 0-1.26.135-1.815.39-.225.09-.285.18-.285.375v8.4c0 .195.15.375.345.39h6.885c1.35 0 2.445-1.095 2.445-2.445 0-1.35-1.095-2.445-2.445-2.445v-.003z" />
      </svg>
    );
  }
  if (service === "tiktok") {
    return (
      <svg className="w-5 h-5 text-pink-500 transition-all" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    );
  }
  if (service === "spotify") {
    return (
      <svg className="w-5 h-5 text-green-500 transition-all" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>
    );
  }
  if (service === "twitter") {
    return (
      <svg className="w-5 h-5 text-gray-300 transition-all" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  if (service === "instagram") {
    return (
      <svg className="w-5 h-5 text-pink-400 transition-all" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    );
  }
  if (service === "twitch") {
    return (
      <svg className="w-5 h-5 text-purple-500 transition-all" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
      </svg>
    );
  }
  if (service === "reddit") {
    return (
      <svg className="w-5 h-5 text-orange-600 transition-all" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
      </svg>
    );
  }
  if (service === "vimeo") {
    return (
      <svg className="w-5 h-5 text-cyan-400 transition-all" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z" />
      </svg>
    );
  }
  if (service === "facebook") {
    return (
      <svg className="w-5 h-5 text-blue-500 transition-all" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }
  if (service === "bandcamp") {
    return (
      <svg className="w-5 h-5 text-teal-400 transition-all" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z" />
      </svg>
    );
  }
  if (service === "dailymotion") {
    return (
      <svg className="w-5 h-5 text-blue-400 transition-all" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.946 18.151v-5.239c0-.696.094-1.202.281-1.525.188-.318.478-.479.873-.479.345 0 .594.135.755.406.156.27.234.701.234 1.291v5.546h3.377v-6.129c0-.932-.109-1.651-.323-2.151-.219-.505-.594-.9-1.125-1.182-.531-.28-1.188-.422-1.964-.422-.793 0-1.474.193-2.053.573-.355.24-.729.617-1.125 1.13V6.031h-3.37v12.12h4.44zM6.929 12.953c0 1.085.255 1.941.771 2.567.511.625 1.193.937 2.048.937.401 0 .761-.078 1.073-.229v-3.025c0-.531-.141-.935-.422-1.219-.281-.281-.667-.422-1.162-.422-.495 0-.896.167-1.198.5-.302.328-.457.797-.457 1.406-.255.568-.653-.515-.653-.515z" />
      </svg>
    );
  }
  if (service === "pinterest") {
    return (
      <svg className="w-5 h-5 text-red-600 transition-all" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
      </svg>
    );
  }
  // Default link icon
  return (
    <svg className="w-5 h-5 text-gray-500 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
};

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
            setYoutubeWarning("o google não deixa a gente baixar do youtube no celular. é complicado. baixa o app desktop.");
          } else {
            setYoutubeWarning("tem link do youtube aí. infelizmente não funciona pelo navegador. questões legais, sabe como é.");
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
          setYoutubeWarning("youtube no celular? nem a gente consegue contornar isso. tenta pelo computador.");
        } else {
          setYoutubeWarning("ah, youtube... o google complica as coisas. baixa o app desktop e a gente resolve isso.");
        }
        return;
      }

      // Check Spotify DRM restriction
      if (/spotify/i.test(trimmedUrl)) {
        setYoutubeWarning("spotify tá com proteção DRM no momento. estamos trabalhando nisso. por enquanto, tenta soundcloud ou youtube music.");
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
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${!isBatchMode
                ? "bg-dark-700 text-white"
                : "text-gray-500 hover:text-gray-300"
                }`}
            >
              URL única
            </button>
            <button
              type="button"
              onClick={() => setIsBatchMode(true)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${isBatchMode
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
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <ServiceIcon service={detectService(url)} />
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
