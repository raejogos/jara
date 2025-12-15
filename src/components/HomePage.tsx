import { useState, useEffect, useRef } from "react";

interface Action {
    id: string;
    label: string;
    keywords: string[];
    context: {
        tab: "convert" | "download";
        action: string;
    };
}

const actions: Action[] = [
    // Video Tools
    {
        id: "video-to-mp3",
        label: "converter mp4>mp3",
        keywords: ["converter", "video", "audio", "musica", "extrair"],
        context: { tab: "convert", action: "video-to-mp3" }
    },
    {
        id: "trim-video",
        label: "cortar vídeo",
        keywords: ["cortar", "trim", "clipar", "editar"],
        context: { tab: "convert", action: "trim-video" }
    },
    {
        id: "video-to-gif",
        label: "converter vídeo>gif",
        keywords: ["gif", "video", "converter", "animacao"],
        context: { tab: "convert", action: "video-to-gif" }
    },

    // Audio Tools
    {
        id: "transcribe",
        label: "transcrever áudio",
        keywords: ["transcrever", "ia", "texto", "legendas", "whisper"],
        context: { tab: "convert", action: "transcribe-audio" }
    },

    // Image Tools
    {
        id: "remove-bg",
        label: "remover fundo",
        keywords: ["fundo", "background", "remover", "png", "transparente"],
        context: { tab: "convert", action: "remove-bg" }
    },
    {
        id: "webp-to-png",
        label: "converter webp>png",
        keywords: ["webp", "png", "imagem", "converter"],
        context: { tab: "convert", action: "webp-to-png" }
    },
    {
        id: "image-to-pdf",
        label: "converter imagem>pdf",
        keywords: ["pdf", "imagem", "converter", "documento"],
        context: { tab: "convert", action: "image-to-pdf" }
    },
    {
        id: "svg-editor",
        label: "editor svg",
        keywords: ["svg", "editor", "codigo", "bloco", "imagem"],
        context: { tab: "convert", action: "svg-editor" }
    },
    {
        id: "qr-code",
        label: "gerador qr code",
        keywords: ["qr", "code", "codigo", "gerar", "link", "url"],
        context: { tab: "convert", action: "qr-code" }
    },
    {
        id: "base64",
        label: "conversor base64",
        keywords: ["base64", "converter", "encode", "decode", "texto"],
        context: { tab: "convert", action: "base64" }
    },
    {
        id: "color-palette",
        label: "extrair paleta de cores",
        keywords: ["cor", "cores", "paleta", "extrair", "imagem", "color"],
        context: { tab: "convert", action: "color-palette" }
    },
    {
        id: "color-picker",
        label: "conta-gotas",
        keywords: ["cor", "cores", "picker", "escolher", "hex", "rgb", "conta", "gotas", "capturar"],
        context: { tab: "convert", action: "color-picker" }
    },
    {
        id: "exif",
        label: "ver exif e remover",
        keywords: ["exif", "metadados", "metadata", "remover", "limpar", "foto", "jpeg"],
        context: { tab: "convert", action: "exif" }
    },
    {
        id: "merge-pdf",
        label: "juntar pdfs",
        keywords: ["juntar", "pdf", "unir", "mesclar", "combinar"],
        context: { tab: "convert", action: "merge-pdf" }
    },
    {
        id: "split-pdf",
        label: "cortar pdf",
        keywords: ["cortar", "pdf", "dividir", "paginas", "separar"],
        context: { tab: "convert", action: "split-pdf" }
    },

    {
        id: "compress-image",
        label: "comprimir imagem",
        keywords: ["comprimir", "imagem", "reduzir", "tamanho", "jpg", "png"],
        context: { tab: "convert", action: "compress-image" }
    },
    {
        id: "mkv-to-mp4",
        label: "converter mkv>mp4",
        keywords: ["mkv", "mp4", "video", "converter"],
        context: { tab: "convert", action: "mkv-to-mp4" }
    },
    {
        id: "wav-to-mp3",
        label: "converter wav>mp3",
        keywords: ["wav", "mp3", "audio", "converter"],
        context: { tab: "convert", action: "wav-to-mp3" }
    },

    // Download
    {
        id: "download-video",
        label: "baixar vídeo",
        keywords: ["baixar", "download", "video", "youtube", "tiktok"],
        context: { tab: "download", action: "" }
    },
    {
        id: "download-audio",
        label: "baixar música",
        keywords: ["baixar", "audio", "musica", "mp3", "spotify", "soundcloud"],
        context: { tab: "download", action: "download-audio" }
    }
];

interface HomePageProps {
    onNavigate: (tab: "convert" | "download", action?: string, url?: string) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<Action[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (query.trim() === "") {
            setSuggestions([]);
            setSelectedIndex(-1);
            return;
        }

        const lowerQuery = query.toLowerCase().trim();
        const queryWords = lowerQuery.split(/\s+/);

        const filtered = actions.filter(action => {
            const searchableText = [
                action.label.toLowerCase(),
                ...action.keywords.map(k => k.toLowerCase())
            ].join(" ");
            return queryWords.every(word => searchableText.includes(word));
        });

        setSuggestions(filtered);
        setSelectedIndex(-1);
    }, [query]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === "Enter") {
            // Check if query is a URL
            const trimmedQuery = query.trim();
            if (trimmedQuery.startsWith("http://") || trimmedQuery.startsWith("https://")) {
                // Navigate to download with the URL
                onNavigate("download", undefined, trimmedQuery);
                return;
            }

            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                handleSelect(suggestions[selectedIndex]);
            } else if (suggestions.length > 0) {
                handleSelect(suggestions[0]);
            }
        }
    };

    const handleSelect = (action: Action) => {
        onNavigate(action.context.tab, action.context.action);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 animate-fade-in relative z-10 w-full max-w-xl mx-auto">

            {/* Logo - Pixel Art Style per user preference hints */}
            <div className="text-center mb-12">
                <div className="mb-6 inline-flex items-center justify-center w-20 h-20 bg-black border border-white/10 rounded-2xl shadow-2xl">
                    <img src="/icon.png" alt="Jara" className="w-10 h-10 object-contain" />
                </div>
                {/* Pixel font title */}
                <h1 className="text-4xl text-white tracking-tight" style={{ fontFamily: "'Press Start 2P', cursive" }}>jara</h1>
            </div>

            {/* Search Bar Container */}
            <div className="w-full relative group z-50">

                {/* The Input Box */}
                <div className="relative bg-black border border-white/20 rounded-xl shadow-2xl overflow-hidden transition-all duration-300 focus-within:ring-1 focus-within:ring-white/30 focus-within:border-white/40">
                    <div className="flex items-center px-4 py-3">

                        {/* Static 'jara:' badge */}
                        <div className="flex items-center gap-3 pl-3 pr-4 py-2 bg-white/10 rounded-md mr-3 select-none">
                            <img src="/icon.png" className="w-3.5 h-3.5 opacity-70" />
                            <span className="text-xs font-mono text-gray-300 tracking-wider leading-none">jara: </span>
                        </div>

                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="pesquisa"
                            className="w-full bg-transparent text-base text-white placeholder-gray-600 focus:outline-none font-mono"
                            autoFocus
                        />

                        {query && (
                            <button onClick={() => setQuery("")} className="text-gray-600 hover:text-white transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Suggestions Dropdown */}
                    {suggestions.length > 0 && (
                        <div className="border-t border-white/10 max-h-64 overflow-y-auto custom-scrollbar bg-black">
                            {suggestions.map((action, index) => (
                                <button
                                    key={action.id}
                                    onClick={() => handleSelect(action)}
                                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors ${index === selectedIndex ? 'bg-white/10' : ''}`}
                                >
                                    {/* Suggestion Badge */}
                                    <div className="flex items-center gap-3 pl-3 pr-4 py-2 bg-white/5 border border-white/10 rounded-md select-none">
                                        <img src="/icon.png" className="w-3.5 h-3.5 opacity-50" />
                                        <span className="text-xs font-mono text-gray-500 tracking-wider leading-none">jara:</span>
                                    </div>

                                    <span className="text-white text-sm font-mono tracking-tight">{action.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {query && suggestions.length === 0 && (
                        <div className="p-4 text-center font-mono text-xs border-t border-white/10">
                            {query.trim().startsWith("http://") || query.trim().startsWith("https://") ? (
                                <span className="text-green-400">⏎ enter para baixar</span>
                            ) : (
                                <span className="text-gray-600">comando não encontrado</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
