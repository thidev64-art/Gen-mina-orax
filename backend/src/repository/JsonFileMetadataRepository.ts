import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { RecordingMetadata } from '../types/index.js';
import { MetadataRepository } from './MetadataRepository.js';

export class JsonFileMetadataRepository implements MetadataRepository {
  readonly backendType = 'local_disk' as const;
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath =
      filePath || path.resolve(process.cwd(), 'data', 'recordings.json');
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  private async readAll(): Promise<RecordingMetadata[]> {
    try {
      const content = await fs.promises.readFile(this.filePath, 'utf-8');
      return JSON.parse(content) as RecordingMetadata[];
    } catch {
      return [];
    }
  }

  private async writeAll(items: RecordingMetadata[]): Promise<void> {
    const tempPath = `${this.filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    await fs.promises.writeFile(tempPath, JSON.stringify(items, null, 2), 'utf-8');
    await fs.promises.rename(tempPath, this.filePath);
  }

  async saveRecording(recording: RecordingMetadata): Promise<void> {
    const items = await this.readAll();
    const existingIndex = items.findIndex((r) => r.id === recording.id);
    if (existingIndex >= 0) {
      items[existingIndex] = recording;
    } else {
      items.push(recording);
    }
    await this.writeAll(items);
  }

  async getRecordingById(id: string): Promise<RecordingMetadata | null> {
    const items = await this.readAll();
    return items.find((r) => r.id === id) || null;
  }

  async listRecordings(filter?: {
    languageId?: string;
    status?: string;
    speakerId?: string;
  }): Promise<RecordingMetadata[]> {
    let items = await this.readAll();

    if (filter?.languageId) {
      items = items.filter((r) => r.languageId === filter.languageId);
    }
    if (filter?.status) {
      items = items.filter((r) => r.status === filter.status);
    }
    if (filter?.speakerId) {
      items = items.filter((r) => r.speakerId === filter.speakerId);
    }

    // Sort newest first
    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateRecordingStatus(
    id: string,
    update: {
      status: 'validated' | 'rejected';
      rejectionReason?: string | null;
      reviewedBy?: string | null;
      reviewedAt: string;
    }
  ): Promise<RecordingMetadata | null> {
    const items = await this.readAll();
    const index = items.findIndex((r) => r.id === id);
    if (index === -1) return null;

    items[index] = {
      ...items[index],
      status: update.status,
      rejectionReason: update.rejectionReason ?? null,
      reviewedBy: update.reviewedBy ?? 'admin',
      reviewedAt: update.reviewedAt,
      updatedAt: new Date().toISOString()
    };

    await this.writeAll(items);
    return items[index];
  }

  async getNextTakeNumber(promptId: string, speakerId: string): Promise<number> {
    const items = await this.readAll();
    // Count previous takes for this prompt and this speaker (or total takes for this prompt)
    const existingTakes = items.filter(
      (r) => r.promptId === promptId && r.speakerId === speakerId
    );
    return existingTakes.length + 1;
  }

  async deleteRecording(id: string): Promise<boolean> {
    const items = await this.readAll();
    const filtered = items.filter((r) => r.id !== id);
    if (filtered.length !== items.length) {
      await this.writeAll(filtered);
      return true;
    }
    return false;
  }

  async deleteRecordingsBySpeaker(speakerId: string): Promise<number> {
    const items = await this.readAll();
    const filtered = items.filter((r) => r.speakerId !== speakerId);
    const deletedCount = items.length - filtered.length;
    if (deletedCount > 0) {
      await this.writeAll(filtered);
    }
    return deletedCount;
  }
}
