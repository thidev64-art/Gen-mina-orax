import { Readable } from 'stream';

export interface AudioStreamRange {
  start: number;
  end?: number;
}

export interface AudioStreamResult {
  stream: Readable;
  mimeType: string;
  contentLength?: number;
  totalSize?: number;
  range?: { start: number; end: number };
}

export interface AudioStorageService {
  readonly backendType: 'cloudflare_r2' | 'local_disk';

  uploadAudio(
    storageKey: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ storageKey: string; audioUrl: string }>;

  getAudioStream(
    storageKey: string,
    range?: AudioStreamRange
  ): Promise<AudioStreamResult>;

  deleteAudio(storageKey: string): Promise<void>;
}
