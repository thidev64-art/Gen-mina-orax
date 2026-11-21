export interface Language {
  id: string; // e.g. 'mina', 'fr', 'wo', 'bm', 'yo', 'fon', 'ln', 'sw'
  code: string;
  name: string;
  nativeName: string;
  region: string;
  direction?: 'ltr' | 'rtl';
  description: string;
}

export interface PromptParticipantStatus {
  completed: boolean;
  takesCount: number;
  lastRecordedAt?: string;
}

export interface Prompt {
  id: string;
  languageId: string;
  text: string;
  category: 'general' | 'numbers' | 'daily_life' | 'cultural' | 'tech';
  difficulty: 'easy' | 'medium' | 'hard';
  source?: string;
  validatedByNativeSpeaker?: boolean;
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

export interface HealthInfo {
  status: string;
  service: string;
  timestamp: string;
  storageBackend: 'cloudflare_r2' | 'local_disk';
  databaseBackend: 'cloud_firestore' | 'local_disk';
  consentBackend?: 'cloud_firestore' | 'local_disk';
}

export interface ConsentRecord {
  speakerId: string;
  recoveryCode?: string;
  recoveryCodeHash?: string;
  consentGiven: boolean;
  consentVersion: string;
  timestamp: string;
  status: 'active' | 'revoked';
  revokedAt?: string | null;
}

export const CATEGORY_LABELS: Record<string, string> = {
  daily_life: 'Vie quotidienne',
  cultural: 'Culture & Proverbes',
  numbers: 'Nombres & Heures',
  tech: 'Technologie & Avenir',
  general: 'Général'
};
