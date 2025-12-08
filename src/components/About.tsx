export function About() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        {/* Logo - will use custom icon from assets */}
        <div className="w-20 h-20 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center mx-auto mb-6 overflow-hidden">
          <img 
            src="/icon.png" 
            alt="Jara" 
            className="w-12 h-12 object-contain"
            onError={(e) => {
              // Fallback if icon doesn't exist
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement!.innerHTML = `
                <svg class="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              `;
            }}
          />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Jara</h1>

        {/* Version */}
        <p className="text-gray-500 text-sm mb-8">v1.0.0</p>

        {/* Description */}
        <p className="text-gray-400 mb-8">
          interface gráfica para{" "}
          <a
            href="https://github.com/yt-dlp/yt-dlp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline"
          >
            yt-dlp
          </a>
        </p>

        {/* Links */}
        <div className="space-y-3">
          <a
            href="https://github.com/yt-dlp/yt-dlp#supported-sites"
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-gray-300 hover:bg-dark-700 hover:text-white transition-colors"
          >
            sites suportados
          </a>
          
          <a
            href="https://github.com/yt-dlp/yt-dlp"
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-gray-300 hover:bg-dark-700 hover:text-white transition-colors"
          >
            yt-dlp no github
          </a>
        </div>

        {/* Footer */}
        <p className="text-gray-600 text-xs mt-12">
          construído com tauri + react
        </p>
      </div>
    </div>
  );
}
