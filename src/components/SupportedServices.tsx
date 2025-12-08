import { useState } from "react";

const popularServices = [
  "youtube",
  "tiktok",
  "instagram",
  "twitter",
  "facebook",
  "soundcloud",
  "spotify",
  "twitch",
  "vimeo",
  "dailymotion",
  "bilibili",
  "reddit",
  "pinterest",
  "tumblr",
  "bandcamp",
  "mixcloud",
];

const moreServices = [
  "rutube",
  "ok.ru",
  "vk",
  "weibo",
  "nicovideo",
  "vlive",
  "naver",
  "afreecatv",
  "streamable",
  "dropbox",
  "mediafire",
  "archive.org",
  "ted",
  "imdb",
  "crunchyroll",
  "funimation",
];

export function SupportedServicesButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-400 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
        <span className="text-xs font-mono tracking-wider">serviços suportados</span>
      </button>

      {isOpen && (
        <SupportedServicesModal onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}

interface ModalProps {
  onClose: () => void;
}

function SupportedServicesModal({ onClose }: ModalProps) {
  const [showMore, setShowMore] = useState(false);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div 
        className="relative bg-dark-900 border border-dark-700 rounded-2xl p-6 max-w-md w-full animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-mono tracking-wider text-gray-400">serviços suportados</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Services Grid */}
        <div className="flex flex-wrap gap-2 mb-4">
          {popularServices.map((service) => (
            <span
              key={service}
              className="px-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-xs font-mono text-gray-400"
            >
              {service}
            </span>
          ))}

          {showMore && moreServices.map((service) => (
            <span
              key={service}
              className="px-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-xs font-mono text-gray-400"
            >
              {service}
            </span>
          ))}
        </div>

        {/* Show More / Less */}
        <button
          onClick={() => setShowMore(!showMore)}
          className="text-xs font-mono text-gray-600 hover:text-gray-400 transition-colors mb-4"
        >
          {showMore ? "mostrar menos" : "mostrar mais..."}
        </button>

        {/* Footer */}
        <div className="pt-4 border-t border-dark-700">
          <p className="text-[10px] font-mono text-gray-700 mb-3 tracking-wider">
            suporta 1000+ sites através do yt-dlp
          </p>
          <a
            href="https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-xs font-mono text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            ver lista completa
          </a>
        </div>
      </div>
    </div>
  );
}
