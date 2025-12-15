import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Store active downloads
const downloads = new Map();

app.use(cors());
app.use(express.json());

// Serve static files from dist (built frontend)
app.use(express.static(path.join(__dirname, '../dist')));

// Downloads folder
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Get video info
app.post('/api/video-info', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const ytdlp = spawn('yt-dlp', [
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        url
      ]);

      let stdout = '';
      let stderr = '';

      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytdlp.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout);
            resolve({
              id: info.id,
              title: info.title,
              thumbnail: info.thumbnail,
              duration: info.duration,
              duration_string: info.duration_string,
              uploader: info.uploader,
              view_count: info.view_count,
              formats: (info.formats || []).map(f => ({
                format_id: f.format_id,
                format_note: f.format_note,
                ext: f.ext,
                resolution: f.resolution,
                filesize: f.filesize,
                filesize_approx: f.filesize_approx,
                vcodec: f.vcodec,
                acodec: f.acodec,
                quality: f.quality,
                fps: f.fps,
                tbr: f.tbr,
              })),
            });
          } catch (e) {
            reject(new Error('Failed to parse video info'));
          }
        } else {
          reject(new Error(stderr || 'Failed to get video info'));
        }
      });
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get playlist info
app.post('/api/playlist-info', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const ytdlp = spawn('yt-dlp', [
        '--flat-playlist',
        '--dump-json',
        '--no-warnings',
        url
      ]);

      let stdout = '';
      let stderr = '';

      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytdlp.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout);
            const entries = (info.entries || []).map(e => ({
              id: e.id,
              title: e.title || 'Sem título',
              url: e.url || e.webpage_url || '',
              duration: e.duration,
              duration_string: e.duration_string,
              thumbnail: e.thumbnail,
            }));
            resolve({
              id: info.id,
              title: info.title || 'Playlist',
              uploader: info.uploader,
              entries,
              entry_count: entries.length,
            });
          } catch (e) {
            reject(new Error('Failed to parse playlist info'));
          }
        } else {
          reject(new Error(stderr || 'Failed to get playlist info'));
        }
      });
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start download
app.post('/api/download', async (req, res) => {
  const { url, format_id, audio_only } = req.body;
  const downloadId = uuidv4();

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const args = [
    '--newline',
    '--progress',
    '-o', path.join(DOWNLOADS_DIR, '%(title)s.%(ext)s'),
  ];

  if (audio_only) {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else if (format_id) {
    args.push('-f', format_id);
  }

  args.push(url);

  const ytdlp = spawn('yt-dlp', args);

  downloads.set(downloadId, {
    process: ytdlp,
    progress: 0,
    status: 'downloading',
    filename: null,
  });

  ytdlp.stdout.on('data', (data) => {
    const line = data.toString();
    const download = downloads.get(downloadId);
    if (!download) return;

    // Capture progress
    const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*)%/);
    if (progressMatch) {
      download.progress = parseFloat(progressMatch[1]);
    }

    // Capture destination from download
    const destMatch = line.match(/\[download\] Destination: (.+)/);
    if (destMatch) {
      download.filename = path.basename(destMatch[1].trim());
    }

    // Capture destination from audio extraction (overwrites download destination)
    const extractMatch = line.match(/\[ExtractAudio\] Destination: (.+)/);
    if (extractMatch) {
      download.filename = path.basename(extractMatch[1].trim());
    }

    // Capture "already downloaded" case
    const alreadyMatch = line.match(/\[download\] (.+) has already been downloaded/);
    if (alreadyMatch) {
      download.filename = path.basename(alreadyMatch[1].trim());
    }

    // Capture merged output (final filename after combining video+audio)
    const mergeMatch = line.match(/\[Merger\] Merging formats into "(.+)"/);
    if (mergeMatch) {
      download.filename = path.basename(mergeMatch[1].trim());
    }

    // Capture ffmpeg destination (another common pattern)
    const ffmpegMatch = line.match(/Destination: (.+\.(mp4|mkv|webm|mp3|m4a))/i);
    if (ffmpegMatch) {
      download.filename = path.basename(ffmpegMatch[1].trim());
    }

    // Log for debugging
    console.log('[yt-dlp]', line.trim());
  });

  ytdlp.stderr.on('data', (data) => {
    const line = data.toString();
    console.log('[yt-dlp stderr]', line.trim());
  });

  ytdlp.on('close', (code) => {
    const download = downloads.get(downloadId);
    if (download) {
      download.status = code === 0 ? 'completed' : 'error';
      download.progress = code === 0 ? 100 : download.progress;

      // Try to find the actual file if the captured filename doesn't exist
      if (download.filename) {
        const capturedPath = path.join(DOWNLOADS_DIR, download.filename);
        if (!fs.existsSync(capturedPath)) {
          // Try to find a similar file (without format code like .f251)
          const baseName = download.filename.replace(/\.f\d+\./, '.');
          const altPath = path.join(DOWNLOADS_DIR, baseName);
          if (fs.existsSync(altPath)) {
            download.filename = baseName;
          } else {
            // Look for any file matching the title
            const titleBase = download.filename.split('.')[0];
            const files = fs.readdirSync(DOWNLOADS_DIR);
            const match = files.find(f => f.startsWith(titleBase));
            if (match) {
              download.filename = match;
            }
          }
        }
      }
    }
  });

  res.json({ downloadId });
});

// Get download progress
app.get('/api/download/:id/progress', (req, res) => {
  const download = downloads.get(req.params.id);
  if (!download) {
    return res.status(404).json({ error: 'Download not found' });
  }
  res.json({
    progress: download.progress,
    status: download.status,
    filename: download.filename,
  });
});

// Cancel download
app.delete('/api/download/:id', (req, res) => {
  const download = downloads.get(req.params.id);
  if (!download) {
    return res.status(404).json({ error: 'Download not found' });
  }
  download.process.kill();
  download.status = 'cancelled';
  res.json({ success: true });
});

// Download file
app.get('/api/download/:id/file', (req, res) => {
  const download = downloads.get(req.params.id);
  if (!download || !download.filename) {
    return res.status(404).json({ error: 'File not found' });
  }

  const filePath = path.join(DOWNLOADS_DIR, download.filename);

  // Verify file exists before trying to send
  if (!fs.existsSync(filePath)) {
    // Try removing format code from filename
    const baseName = download.filename.replace(/\.f\d+\./, '.');
    const altPath = path.join(DOWNLOADS_DIR, baseName);
    if (fs.existsSync(altPath)) {
      return res.download(altPath);
    }

    return res.status(404).json({ error: 'File not found on disk' });
  }

  res.download(filePath);
});

// List downloaded files
app.get('/api/files', (req, res) => {
  const files = fs.readdirSync(DOWNLOADS_DIR).map(filename => ({
    name: filename,
    path: path.join(DOWNLOADS_DIR, filename),
    size: fs.statSync(path.join(DOWNLOADS_DIR, filename)).size,
  }));
  res.json(files);
});

// Convert image
app.post('/api/convert/image', async (req, res) => {
  // For image conversion, you'd use sharp
  // This is a placeholder - needs file upload handling
  res.status(501).json({ error: 'Image conversion requires file upload - coming soon' });
});

// Serve frontend for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Jara server running on http://localhost:${PORT}`);
});

