# Script para baixar o yt-dlp.exe para a pasta de recursos

$outputPath = Join-Path $PSScriptRoot "..\src-tauri\resources\yt-dlp.exe"
$url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"

Write-Host "Baixando yt-dlp.exe..."

try {
    # Create directory if it doesn't exist
    $dir = Split-Path $outputPath -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    # Download the file
    Invoke-WebRequest -Uri $url -OutFile $outputPath -UseBasicParsing

    Write-Host "yt-dlp.exe baixado com sucesso para: $outputPath" -ForegroundColor Green
}
catch {
    Write-Host "Erro ao baixar yt-dlp.exe: $_" -ForegroundColor Red
    exit 1
}

