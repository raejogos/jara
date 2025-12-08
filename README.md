# Jara

GUI para [yt-dlp](https://github.com/yt-dlp/yt-dlp) + conversor de arquivos.

## Funcionalidades

- Download de vídeos e áudio de 1000+ sites
- Conversão de mídia (vídeo/áudio)
- Conversão de imagens (PNG, JPG, WEBP, etc.)
- Conversão de imagens para PDF

## Requisitos

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install)
- [ffmpeg](https://ffmpeg.org/) (para conversão de mídia)

## Instalação

```bash
npm install
```

Baixe o yt-dlp.exe de [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) e coloque em `src-tauri/resources/`

## Desenvolvimento

```bash
npm run tauri dev
```

## Build

```bash
npm run tauri build
```
