import { AudioStorageService } from './AudioStorageService.js';
import { DiskAudioStorage } from './DiskAudioStorage.js';
import { R2AudioStorage } from './R2AudioStorage.js';

let storageInstance: AudioStorageService | null = null;

export function getAudioStorage(): AudioStorageService {
  if (storageInstance) {
    return storageInstance;
  }

  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (accountId && accessKeyId && secretAccessKey && bucketName) {
    console.log('[Storage] Initialisation du stockage Cloudflare R2...');
    storageInstance = new R2AudioStorage({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicDomain: process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN
    });
    console.log(`[Storage] Stockage Cloudflare R2 activé (Bucket: ${bucketName}).`);
  } else {
    console.warn(
      '[Storage] Variables Cloudflare R2 non renseignées. Activation du stockage réel sur disque local (data/uploads).'
    );
    storageInstance = new DiskAudioStorage();
    console.log('[Storage] Stockage local sur disque actif (fichiers réels conservés).');
  }

  return storageInstance;
}

export * from './AudioStorageService.js';
export * from './DiskAudioStorage.js';
export * from './R2AudioStorage.js';
