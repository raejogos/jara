export function About() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        {/* Logo + Nome */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <img
            src="/icon.png"
            alt="Jara"
            className="w-20 h-20 object-contain"
          />
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2">
            Jara
          </h2>
        </div>

        {/* Version */}
        <p className="text-gray-500 text-sm mb-6">v1.2.0</p>

        {/* Description */}
        <div className="text-gray-400 mb-8 space-y-2">
          <p>sua capivara de downloads favorita</p>
          <p className="text-gray-600 text-sm">
            (na real é só uma interface bonita pro{" "}
            <a
              href="https://github.com/yt-dlp/yt-dlp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:underline"
            >
              yt-dlp
            </a>
            )
          </p>
        </div>

        {/* Fun facts */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 mb-8 text-left">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">informações legalmente necessárias</p>
          <ul className="text-gray-400 text-sm space-y-2">
            <li>• pirataria é bacana</li>
            <li>• downloads 100% locais (a gente nem quer saber)</li>
            <li>• a capivara não é real, pode relaxar</li>
            <li>• isso aqui é só um wrapper glorificado</li>
          </ul>
        </div>

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
            href="https://github.com/raejogos/jara"
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-gray-300 hover:bg-dark-700 hover:text-white transition-colors"
          >
            ver código fonte
          </a>
        </div>

        {/* Footer */}
        <p className="text-gray-600 text-xs mt-12">
          tauri + react + tempo livre mal investido
        </p>
      </div>
    </div>
  );
}
