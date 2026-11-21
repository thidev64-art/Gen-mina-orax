import fs from 'fs';
import path from 'path';
import { AudioStorageService, AudioStreamRange, AudioStreamResult } from './AudioStorageService.js';

export class DiskAudioStorage implements AudioStorageService {
  readonly backendType = 'local_disk' as const;
  private uploadDir: string;

  constructor(uploadDir?: string) {
    this.uploadDir = uploadDir || path.resolve(process.cwd(), 'data', 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadAudio(
    storageKey: string,
    buffer: Buffer,
    _mimeType: string
  ): Promise<{ storageKey: string; audioUrl: string }> {
    const filePath = path.join(this.uploadDir, storageKey);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(filePath, buffer);
    return {
      storageKey,
      audioUrl: `/api/recordings/audio/${encodeURIComponent(storageKey)}`
    };
  }

  async getAudioStream(
    storageKey: string,
    range?: AudioStreamRange
  ): Promise<AudioStreamResult> {
    const filePath = path.join(this.uploadDir, storageKey);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier audio introuvable sur le disque : ${storageKey}`);
    }

    const stat = await fs.promises.stat(filePath);
    const totalSize = stat.size;
    const ext = path.extname(storageKey).toLowerCase();
    let mimeType = 'audio/webm';
    if (ext === '.wav') mimeType = 'audio/wav';
    else if (ext === '.ogg' || ext === '.oga') mimeType = 'audio/ogg';
    else if (ext === '.mp3') mimeType = 'audio/mpeg';
    else if (ext === '.m4a' || ext === '.mp4') mimeType = 'audio/mp4';

    if (range && totalSize > 0) {
      const start = Math.max(0, Math.min(range.start, totalSize - 1));
      const end = range.end !== undefined ? Math.min(range.end, totalSize - 1) : totalSize - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      return {
        stream,
        mimeType,
        contentLength: chunkSize,
        totalSize,
        range: { start, end }
      };
    }

    const stream = fs.createReadStream(filePath);
    return {
      stream,
      mimeType,
      contentLength: totalSize,
      totalSize
    };
  }

  async deleteAudio(storageKey: string): Promise<void> {
    const filePath = path.join(this.uploadDir, storageKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }
}
