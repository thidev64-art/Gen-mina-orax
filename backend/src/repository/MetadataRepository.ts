import { RecordingMetadata } from '../types/index.js';

export interface MetadataRepository {
  readonly backendType: 'cloud_firestore' | 'local_disk';

  saveRecording(recording: RecordingMetadata): Promise<void>;

  getRecordingById(id: string): Promise<RecordingMetadata | null>;

  listRecordings(filter?: {
    languageId?: string;
    status?: string;
    speakerId?: string;
  }): Promise<RecordingMetadata[]>;

  updateRecordingStatus(
    id: string,
    update: {
      status: 'validated' | 'rejected';
      rejectionReason?: string | null;
      reviewedBy?: string | null;
      reviewedAt: string;
    }
  ): Promise<RecordingMetadata | null>;

  getNextTakeNumber(promptId: string, speakerId: string): Promise<number>;

  deleteRecording(id: string): Promise<boolean>;

  deleteRecordingsBySpeaker(speakerId: string): Promise<number>;
}
