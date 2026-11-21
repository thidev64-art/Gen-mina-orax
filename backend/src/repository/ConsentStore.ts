import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Firestore } from '@google-cloud/firestore';
import { ConsentRecord } from '../types/index.js';
import { getSharedFirestoreClient } from './firestoreClient.js';

/**
 * Génère un code de récupération cryptographiquement sûr, court, lisible et non ambigu.
 * Alphabet de 32 caractères : suppression des chiffres et lettres prêtant à confusion (0, O, 1, I).
 * Format : MINA-XXXX-XXXX (ex: MINA-7K9Q-X24V)
 */
export function generateRecoveryCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(crypto.randomInt(0, chars.length));
    part2 += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return `MINA-${part1}-${part2}`;
}

/**
 * Normalise et calcule l'empreinte cryptographique SHA-256 du code de récupération.
 * Permet de ne jamais stocker le code de récupération en clair.
 */
export function hashRecoveryCode(recoveryCode: string): string {
  const clean = recoveryCode.trim().toUpperCase();
  return crypto.createHash('sha256').update(clean, 'utf-8').digest('hex');
}

/**
 * Comparaison cryptographique sécurisée à temps constant pour prévenir les attaques temporelles.
 */
function safeTimingEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function sanitizeConsentRecord(record: ConsentRecord): ConsentRecord {
  const copy = { ...record };
  delete copy.recoveryCode;
  return copy;
}

export interface IConsentStore {
  readonly backendType: 'cloud_firestore' | 'local_disk';
  saveConsent(record: ConsentRecord): Promise<void>;
  getConsent(speakerId: string): Promise<ConsentRecord | null>;
  hasActiveConsent(speakerId: string): Promise<boolean>;
  getConsentByRecoveryCode(recoveryCode: string): Promise<ConsentRecord | null>;
  revokeConsent(speakerId: string): Promise<boolean>;
  revokeConsentByRecoveryCode(recoveryCode: string): Promise<{ success: boolean; speakerId?: string }>;
}

/**
 * Stockage local JSON persistant (développement & auto-hébergement sur volume persistant).
 */
export class ConsentStore implements IConsentStore {
  readonly backendType = 'local_disk' as const;
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'data', 'consents.json');
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  private async readAll(): Promise<ConsentRecord[]> {
    try {
      const content = await fs.promises.readFile(this.filePath, 'utf-8');
      return JSON.parse(content) as ConsentRecord[];
    } catch {
      return [];
    }
  }

  private async writeAll(items: ConsentRecord[]): Promise<void> {
    const sanitized = items.map(sanitizeConsentRecord);
    const tempPath = `${this.filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    await fs.promises.writeFile(tempPath, JSON.stringify(sanitized, null, 2), 'utf-8');
    await fs.promises.rename(tempPath, this.filePath);
  }

  async saveConsent(record: ConsentRecord): Promise<void> {
    const items = await this.readAll();
    const existingIndex = items.findIndex((c) => c.speakerId === record.speakerId);
    if (existingIndex >= 0) {
      items[existingIndex] = sanitizeConsentRecord(record);
    } else {
      items.push(sanitizeConsentRecord(record));
    }
    await this.writeAll(items);
  }

  async getConsent(speakerId: string): Promise<ConsentRecord | null> {
    const items = await this.readAll();
    return items.find((c) => c.speakerId === speakerId) || null;
  }

  async hasActiveConsent(speakerId: string): Promise<boolean> {
    const record = await this.getConsent(speakerId);
    return !!(record && record.consentGiven && record.status === 'active');
  }

  async getConsentByRecoveryCode(recoveryCode: string): Promise<ConsentRecord | null> {
    const items = await this.readAll();
    const candidateHash = hashRecoveryCode(recoveryCode);

    const match = items.find((c) => {
      if (!c.recoveryCodeHash) return false;
      return safeTimingEqual(c.recoveryCodeHash, candidateHash) && c.status === 'active';
    });

    return match || null;
  }

  async revokeConsent(speakerId: string): Promise<boolean> {
    const items = await this.readAll();
    const filtered = items.filter((c) => c.speakerId !== speakerId);
    if (filtered.length !== items.length) {
      await this.writeAll(filtered);
      return true;
    }
    return false;
  }

  async revokeConsentByRecoveryCode(recoveryCode: string): Promise<{ success: boolean; speakerId?: string }> {
    const items = await this.readAll();
    const candidateHash = hashRecoveryCode(recoveryCode);

    const target = items.find((c) => {
      if (!c.recoveryCodeHash) return false;
      return safeTimingEqual(c.recoveryCodeHash, candidateHash);
    });

    if (!target) {
      return { success: false };
    }

    const filtered = items.filter((c) => c.speakerId !== target.speakerId);
    await this.writeAll(filtered);
    return { success: true, speakerId: target.speakerId };
  }
}

/**
 * Stockage Cloud Firestore pour déploiement production sans disque local persistant.
 */
export class FirestoreConsentStore implements IConsentStore {
  readonly backendType = 'cloud_firestore' as const;
  private db: Firestore;
  private collectionName: string;

  constructor(config: { db?: Firestore; projectId?: string; keyFilename?: string; collectionName?: string }) {
    this.collectionName = config.collectionName || 'consents';
    this.db =
      config.db ||
      new Firestore({
        projectId: config.projectId,
        keyFilename: config.keyFilename
      });
  }

  async saveConsent(record: ConsentRecord): Promise<void> {
    await this.db
      .collection(this.collectionName)
      .doc(record.speakerId)
      .set(sanitizeConsentRecord(record));
  }

  async getConsent(speakerId: string): Promise<ConsentRecord | null> {
    const doc = await this.db.collection(this.collectionName).doc(speakerId).get();
    if (!doc.exists) return null;
    return doc.data() as ConsentRecord;
  }

  async hasActiveConsent(speakerId: string): Promise<boolean> {
    const record = await this.getConsent(speakerId);
    return !!(record && record.consentGiven && record.status === 'active');
  }

  async getConsentByRecoveryCode(recoveryCode: string): Promise<ConsentRecord | null> {
    const candidateHash = hashRecoveryCode(recoveryCode);
    const snapshot = await this.db
      .collection(this.collectionName)
      .where('recoveryCodeHash', '==', candidateHash)
      .get();

    for (const doc of snapshot.docs) {
      const rec = doc.data() as ConsentRecord;
      if (rec.recoveryCodeHash && safeTimingEqual(rec.recoveryCodeHash, candidateHash) && rec.status === 'active') {
        return rec;
      }
    }
    return null;
  }

  async revokeConsent(speakerId: string): Promise<boolean> {
    const docRef = this.db.collection(this.collectionName).doc(speakerId);
    const doc = await docRef.get();
    if (!doc.exists) return false;
    await docRef.delete();
    return true;
  }

  async revokeConsentByRecoveryCode(recoveryCode: string): Promise<{ success: boolean; speakerId?: string }> {
    const found = await this.getConsentByRecoveryCode(recoveryCode);
    if (!found) return { success: false };
    await this.db.collection(this.collectionName).doc(found.speakerId).delete();
    return { success: true, speakerId: found.speakerId };
  }
}

// Instance singleton avec bascule automatique Firestore / Disque local
let consentStoreInstance: IConsentStore | null = null;
export function getConsentStore(): IConsentStore {
  if (consentStoreInstance) {
    return consentStoreInstance;
  }

  const collectionName = process.env.FIRESTORE_CONSENTS_COLLECTION || 'consents';
  const db = getSharedFirestoreClient();

  if (db) {
    consentStoreInstance = new FirestoreConsentStore({ db, collectionName });
    console.log(`[ConsentStore] Cloud Firestore activé (Collection: ${collectionName}).`);
  } else {
    consentStoreInstance = new ConsentStore();
  }

  return consentStoreInstance;
}
