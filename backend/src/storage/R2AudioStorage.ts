import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { AudioStorageService, AudioStreamRange, AudioStreamResult } from './AudioStorageService.js';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicDomain?: string;
}

export class R2AudioStorage implements AudioStorageService {
  readonly backendType = 'cloudflare_r2' as const;
  private s3Client: S3Client;
  private bucketName: string;
  private publicDomain?: string;

  constructor(config: R2Config) {
    this.bucketName = config.bucketName;
    this.publicDomain = config.publicDomain;

    const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  async uploadAudio(
    storageKey: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ storageKey: string; audioUrl: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        uploadedAt: new Date().toISOString()
      }
    });

    await this.s3Client.send(command);

    let audioUrl = `/api/recordings/audio/${encodeURIComponent(storageKey)}`;
    if (this.publicDomain) {
      const cleanDomain = this.publicDomain.replace(/\/$/, '');
      audioUrl = `${cleanDomain}/${storageKey}`;
    }

    return {
      storageKey,
      audioUrl
    };
  }

  async getAudioStream(
    storageKey: string,
    range?: AudioStreamRange
  ): Promise<AudioStreamResult> {
    const rangeHeader = range
      ? `bytes=${range.start}-${range.end !== undefined ? range.end : ''}`
      : undefined;

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      Range: rangeHeader
    });

    const response = await this.s3Client.send(command);
    if (!response.Body) {
      throw new Error(`Objet audio R2 vide ou introuvable : ${storageKey}`);
    }

    let parsedRange: { start: number; end: number } | undefined;
    let totalSize: number | undefined = response.ContentLength;
    if (response.ContentRange) {
      const match = response.ContentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
      if (match) {
        parsedRange = { start: parseInt(match[1], 10), end: parseInt(match[2], 10) };
        totalSize = parseInt(match[3], 10);
      }
    }

    return {
      stream: response.Body as Readable,
      mimeType: response.ContentType || 'audio/webm',
      contentLength: response.ContentLength,
      totalSize,
      range: parsedRange
    };
  }

  async deleteAudio(storageKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey
    });

    await this.s3Client.send(command);
  }
}
