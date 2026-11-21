import { Firestore } from '@google-cloud/firestore';
import { RecordingMetadata } from '../types/index.js';
import { MetadataRepository } from './MetadataRepository.js';

export interface FirestoreConfig {
  db?: Firestore;
  projectId?: string;
  keyFilename?: string;
  collectionName?: string;
}

export class FirestoreMetadataRepository implements MetadataRepository {
  readonly backendType = 'cloud_firestore' as const;
  private db: Firestore;
  private collectionName: string;

  constructor(config: FirestoreConfig) {
    this.collectionName = config.collectionName || 'recordings';
    this.db =
      config.db ||
      new Firestore({
        projectId: config.projectId,
        keyFilename: config.keyFilename
      });
  }

  async saveRecording(recording: RecordingMetadata): Promise<void> {
    await this.db
      .collection(this.collectionName)
      .doc(recording.id)
      .set(recording);
  }

  async getRecordingById(id: string): Promise<RecordingMetadata | null> {
    const doc = await this.db.collection(this.collectionName).doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as RecordingMetadata;
  }

  async listRecordings(filter?: {
    languageId?: string;
    status?: string;
    speakerId?: string;
  }): Promise<RecordingMetadata[]> {
    let query: FirebaseFirestore.Query = this.db.collection(this.collectionName);

    if (filter?.languageId) {
      query = query.where('languageId', '==', filter.languageId);
    }
    if (filter?.status) {
      query = query.where('status', '==', filter.status);
    }
    if (filter?.speakerId) {
      query = query.where('speakerId', '==', filter.speakerId);
    }

    const snapshot = await query.get();
    const items = snapshot.docs.map((doc) => doc.data() as RecordingMetadata);
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
    const docRef = this.db.collection(this.collectionName).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return null;

    const updatePayload = {
      status: update.status,
      rejectionReason: update.rejectionReason ?? null,
      reviewedBy: update.reviewedBy ?? 'admin',
      reviewedAt: update.reviewedAt,
      updatedAt: new Date().toISOString()
    };

    await docRef.update(updatePayload);
    const updatedDoc = await docRef.get();
    return updatedDoc.data() as RecordingMetadata;
  }

  async getNextTakeNumber(promptId: string, speakerId: string): Promise<number> {
    const snapshot = await this.db
      .collection(this.collectionName)
      .where('promptId', '==', promptId)
      .where('speakerId', '==', speakerId)
      .get();
    return snapshot.size + 1;
  }

  async deleteRecording(id: string): Promise<boolean> {
    const docRef = this.db.collection(this.collectionName).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return false;
    await docRef.delete();
    return true;
  }

  async deleteRecordingsBySpeaker(speakerId: string): Promise<number> {
    const snapshot = await this.db
      .collection(this.collectionName)
      .where('speakerId', '==', speakerId)
      .get();

    const batch = this.db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return snapshot.size;
  }
}
