import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Prompt } from '../types/index.js';
import { PROMPTS as BASE_PROMPTS } from './prompts.js';
import { getSharedFirestoreClient } from '../repository/firestoreClient.js';

const customPromptsFilePath = path.resolve(process.cwd(), 'data', 'prompts_custom.json');
const bundledUdhrFilePath = path.resolve(process.cwd(), 'data', 'mina_udhr_corpus.json');
const firestorePromptsCollection = process.env.FIRESTORE_PROMPTS_COLLECTION || 'prompts';

function getFirestoreForPrompts() {
  return getSharedFirestoreClient();
}

/**
 * Lit le corpus certifié Mina UDHR embarqué dans le dépôt (si présent).
 */
async function loadBundledUdhrPrompts(): Promise<Prompt[]> {
  try {
    if (!fs.existsSync(bundledUdhrFilePath)) {
      return [];
    }
    const content = await fs.promises.readFile(bundledUdhrFilePath, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Lit les phrases personnalisées ou importées (Firestore si configuré, sinon JSON persistant local).
 */
async function loadCustomPrompts(): Promise<Prompt[]> {
  const db = getFirestoreForPrompts();
  if (db) {
    try {
      const snapshot = await db.collection(firestorePromptsCollection).get();
      return snapshot.docs.map((doc) => doc.data() as Prompt);
    } catch (err) {
      console.warn('[PromptStore] Erreur lecture Firestore :', err);
      return [];
    }
  }

  try {
    if (!fs.existsSync(customPromptsFilePath)) {
      return [];
    }
    const content = await fs.promises.readFile(customPromptsFilePath, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[PromptStore] Erreur lors de la lecture de prompts_custom.json :', err);
    return [];
  }
}

/**
 * Récupère l'ensemble des phrases (statiques + corpus UDHR certifié + importées) avec filtrage optionnel.
 */
export async function getAllPrompts(languageId?: string, category?: string): Promise<Prompt[]> {
  const [udhrPrompts, customPrompts] = await Promise.all([
    loadBundledUdhrPrompts(),
    loadCustomPrompts()
  ]);

  // Fusionner sans doublons d'ID (priorité : importées > UDHR > base)
  const promptsMap = new Map<string, Prompt>();

  for (const p of BASE_PROMPTS) {
    promptsMap.set(p.id, p);
  }
  for (const p of udhrPrompts) {
    promptsMap.set(p.id, p);
  }
  for (const p of customPrompts) {
    promptsMap.set(p.id, p);
  }

  let all = Array.from(promptsMap.values());

  if (languageId) {
    all = all.filter((p) => p.languageId === languageId);
  }
  if (category) {
    all = all.filter((p) => p.category === category);
  }

  return all;
}

/**
 * Importe un lot de phrases validées pour enrichir le corpus sans redéployer le code.
 */
export async function importPrompts(newPrompts: Prompt[]): Promise<{ importedCount: number; totalCustomCount: number }> {
  const db = getFirestoreForPrompts();
  if (db) {
    const batch = db.batch();
    for (const p of newPrompts) {
      const ref = db.collection(firestorePromptsCollection).doc(p.id);
      batch.set(ref, p);
    }
    await batch.commit();
    const snapshot = await db.collection(firestorePromptsCollection).get();
    return {
      importedCount: newPrompts.length,
      totalCustomCount: snapshot.size
    };
  }

  const existing = await loadCustomPrompts();
  const map = new Map<string, Prompt>();

  for (const p of existing) {
    map.set(p.id, p);
  }

  let addedOrUpdated = 0;
  for (const p of newPrompts) {
    map.set(p.id, p);
    addedOrUpdated++;
  }

  const merged = Array.from(map.values());
  const dir = path.dirname(customPromptsFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${customPromptsFilePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.promises.writeFile(tempPath, JSON.stringify(merged, null, 2), 'utf-8');
  await fs.promises.rename(tempPath, customPromptsFilePath);

  return {
    importedCount: addedOrUpdated,
    totalCustomCount: merged.length
  };
}
