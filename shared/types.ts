export interface Language {
  id: string; // e.g. 'mina', 'fr', 'wo', 'bm', 'yo', 'fon', 'ln', 'sw'
  code: string;
  name: string;
  nativeName: string;
  region: string;
  direction?: 'ltr' | 'rtl';
  description: string;
}

export interface Prompt {
  id: string;
  languageId: string;
  text: string;
  category: 'general' | 'numbers' | 'daily_life' | 'cultural' | 'tech';
  difficulty: 'easy' | 'medium' | 'hard';
  source?: string;
  validatedByNativeSpeaker?: boolean;
}

export interface PromptParticipantStatus {
  completed: boolean;
  takesCount: number;
  lastRecordedAt?: string;
}

export interface PromptWithStatus extends Prompt {
  participantStatus?: PromptParticipantStatus;
}

export type RecordingStatus = 'pending' | 'validated' | 'rejected';

export interface RecordingMetadata {
  id: string;
  promptId: string;
  promptText: string;
  languageId: string;
  takeNumber: number;
  speakerId: string;
  consentGiven: boolean;
  consentTimestamp: string;
  consentVersion: string;
  audioStorageKey: string;
  audioUrl: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds?: number | null;
  status: RecordingStatus;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  storageBackend: 'cloudflare_r2' | 'local_disk';
  createdAt: string;
  updatedAt: string;
}

export interface ConsentRecord {
  speakerId: string;
  recoveryCodeHash: string;
  recoveryCode?: string;
  consentGiven: boolean;
  consentVersion: string;
  timestamp: string;
  status: 'active' | 'revoked';
  revokedAt?: string | null;
}

export interface CreateRecordingPayload {
  promptId: string;
  promptText: string;
  languageId: string;
  speakerId: string;
  consentGiven: string | boolean;
  consentVersion: string;
  durationSeconds?: string | number;
}

export interface UpdateRecordingStatusPayload {
  status: 'validated' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
}

export interface STTTranscriptionResult {
  text: string;
  confidence: number;
  languageDetected?: string;
  adapterName: string;
}

export interface TTSSynthesisResult {
  audioBuffer: Buffer | Uint8Array;
  mimeType: string;
  adapterName: string;
}
