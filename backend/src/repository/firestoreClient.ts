import { Firestore } from '@google-cloud/firestore';

let cachedFirestore: Firestore | null | undefined = undefined;

/**
 * Retourne une instance partagée Cloud Firestore si les variables d'environnement sont configurées.
 * Supporte au choix :
 * - FIREBASE_SERVICE_ACCOUNT_JSON (JSON brut ou encodé en base64 — idéal pour Render / Railway / Fly.io)
 * - GOOGLE_APPLICATION_CREDENTIALS (chemin vers fichier clé JSON)
 * - FIRESTORE_PROJECT_ID / GOOGLE_CLOUD_PROJECT (Application Default Credentials GCP)
 */
export function getSharedFirestoreClient(): Firestore | null {
  if (cachedFirestore !== undefined) {
    return cachedFirestore;
  }

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const projectId = process.env.FIRESTORE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!rawServiceAccount && !projectId && !keyFilename) {
    cachedFirestore = null;
    return null;
  }

  try {
    if (rawServiceAccount) {
      const jsonText = rawServiceAccount.startsWith('{')
        ? rawServiceAccount
        : Buffer.from(rawServiceAccount, 'base64').toString('utf-8');
      const parsed = JSON.parse(jsonText) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };

      cachedFirestore = new Firestore({
        projectId: projectId || parsed.project_id,
        credentials: {
          client_email: parsed.client_email,
          private_key: parsed.private_key?.replace(/\\n/g, '\n')
        }
      });
      console.log(
        `[Firestore] Client initialisé via FIREBASE_SERVICE_ACCOUNT_JSON (Projet: ${projectId || parsed.project_id || 'défaut'}).`
      );
      return cachedFirestore;
    }

    cachedFirestore = new Firestore({
      projectId,
      keyFilename
    });
    console.log(
      `[Firestore] Client initialisé (Projet: ${projectId || 'défaut'}).`
    );
    return cachedFirestore;
  } catch (err) {
    console.error('[Firestore] Échec initialisation Firestore, repli sur stockage local :', err);
    cachedFirestore = null;
    return null;
  }
}
