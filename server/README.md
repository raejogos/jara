# Jara Server

Backend para rodar Jara como site.

## Requisitos no VPS

- Node.js 18+
- yt-dlp instalado (`pip install yt-dlp` ou baixar binário)
- ffmpeg (para conversões)

## Deploy Rápido

### 1. Instalar dependências do sistema (Ubuntu/Debian)

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# yt-dlp
sudo apt install -y python3-pip
pip3 install yt-dlp

# ffmpeg
sudo apt install -y ffmpeg
```

### 2. Clonar e instalar

```bash
git clone <seu-repo>
cd jara

# Build do frontend
npm install
npm run build

# Instalar servidor
cd server
npm install
```

### 3. Rodar

```bash
# Desenvolvimento
npm run dev

# Produção (use PM2)
npm install -g pm2
pm2 start index.js --name jara
pm2 save
pm2 startup
```

### 4. Nginx (opcional, recomendado)

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. HTTPS com Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com
```

## Variáveis de Ambiente

```bash
PORT=3001  # Porta do servidor (padrão: 3001)
```

## Estrutura

```
server/
├── index.js       # Servidor Express
├── downloads/     # Arquivos baixados (criado automaticamente)
└── package.json
```

## Endpoints da API

- `POST /api/video-info` - Busca info do vídeo
- `POST /api/download` - Inicia download
- `GET /api/download/:id/progress` - Progresso do download
- `DELETE /api/download/:id` - Cancela download
- `GET /api/download/:id/file` - Baixa arquivo
- `GET /api/files` - Lista arquivos

## Dicas

1. **Limite de espaço**: Configure limpeza automática dos downloads
2. **Rate limiting**: Adicione para evitar abuso
3. **Autenticação**: Considere adicionar se for público

