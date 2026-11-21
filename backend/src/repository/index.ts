import { MetadataRepository } from './MetadataRepository.js';
import { JsonFileMetadataRepository } from './JsonFileMetadataRepository.js';
import { FirestoreMetadataRepository } from './FirestoreMetadataRepository.js';
import { getSharedFirestoreClient } from './firestoreClient.js';

let repoInstance: MetadataRepository | null = null;

export function getMetadataRepository(): MetadataRepository {
  if (repoInstance) {
    return repoInstance;
  }

  const collectionName = process.env.FIRESTORE_COLLECTION_NAME || 'recordings';
  const db = getSharedFirestoreClient();

  if (db) {
    repoInstance = new FirestoreMetadataRepository({
      db,
      collectionName
    });
    console.log(`[Repository] Cloud Firestore activé (Collection: ${collectionName}).`);
  } else {
    console.warn(
      '[Repository] Variables Firestore non renseignées. Activation du dépôt JSON persistant sur disque (data/recordings.json).'
    );
    repoInstance = new JsonFileMetadataRepository();
    console.log('[Repository] Dépôt local persistant actif.');
  }

  return repoInstance;
}

export * from './MetadataRepository.js';
export * from './JsonFileMetadataRepository.js';
export * from './FirestoreMetadataRepository.js';
