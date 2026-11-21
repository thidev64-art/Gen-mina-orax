import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import crypto from 'crypto';
import path from 'path';
import { LANGUAGES } from '../data/languages.js';
import { getAllPrompts, importPrompts } from '../data/promptStore.js';
import { getAudioStorage } from '../storage/index.js';
import { getMetadataRepository } from '../repository/index.js';
import { getConsentStore, generateRecoveryCode, hashRecoveryCode } from '../repository/ConsentStore.js';
import { RecordingMetadata, Prompt, ConsentRecord, PromptWithStatus } from '../types/index.js';
import {
  isRecoveryBlocked,
  recordFailedRecovery,
  resetRecoveryAttempts,
  getClientIp
} from '../security/recoveryAuth.js';
import {
  isIpBlocked,
  recordFailedLogin,
  resetLoginAttempts,
  createAdminSession,
  validateAdminSession,
  revokeAdminSession,
  requireAdminAuth,
  verifyAdminCredentials
} from '../security/auth.js';

const router = Router();

// Configuration Multer pour réception audio en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15 Mo max
  },
  fileFilter: (_req, file, cb) => {
    // Vérification stricte des types MIME audio autorisés
    const allowedMimeTypes = [
      'audio/webm',
      'audio/ogg',
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
      'audio/mp4',
      'audio/mpeg',
      'audio/mp3',
      'audio/aac',
      'audio/x-m4a'
    ];

    const cleanMime = file.mimetype.split(';')[0].trim().toLowerCase();
    if (allowedMimeTypes.includes(cleanMime)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Type de fichier non autorisé (${file.mimetype}). Formats acceptés : WebM, OGG, WAV, MP4, AAC.`
        )
      );
    }
  }
});

// Schéma de validation des métadonnées envoyées
const recordingPayloadSchema = z.object({
  promptId: z.string().min(1, 'L\'identifiant de la phrase est requis'),
  promptText: z.string().min(1, 'Le texte de la phrase est requis'),
  languageId: z.string().min(1, 'La langue est requise'),
  speakerId: z.string().min(1, 'L\'identifiant participant est requis'),
  consentGiven: z.union([z.boolean(), z.literal('true')]),
  consentVersion: z.string().min(1, 'La version du consentement est requise'),
  durationSeconds: z.string().optional()
});

// Schéma pour l'import de phrases
const importPromptsSchema = z.array(
  z.object({
    id: z.string().min(1, 'L\'identifiant de la phrase est requis'),
    languageId: z.string().min(1, 'La langue est requise'),
    text: z.string().min(1, 'Le texte est requis'),
    category: z.enum(['general', 'numbers', 'daily_life', 'cultural', 'tech']),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('easy'),
    source: z.string().optional(),
    validatedByNativeSpeaker: z.boolean().optional().default(false)
  })
);

// GET /api/health
router.get('/health', (_req: Request, res: Response) => {
  const storage = getAudioStorage();
  const repo = getMetadataRepository();
  const consentStore = getConsentStore();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Gen/Mina Voice Platform',
    storageBackend: storage.backendType,
    databaseBackend: repo.backendType,
    consentBackend: consentStore.backendType
  });
});

// GET /api/languages
router.get('/languages', (_req: Request, res: Response) => {
  res.json(LANGUAGES);
});

// GET /api/prompts
router.get('/prompts', async (req: Request, res: Response): Promise<void> => {
  try {
    const languageId = req.query.languageId as string | undefined;
    const category = req.query.category as string | undefined;
    const speakerId = req.query.speakerId as string | undefined;
    const unrecordedOnly = req.query.unrecordedOnly as string | undefined;

    const basePrompts = await getAllPrompts(languageId, category);

    // Si speakerId est fourni, enrichir chaque phrase avec son statut pour ce participant
    if (speakerId) {
      const repo = getMetadataRepository();
      const speakerRecordings = await repo.listRecordings({ speakerId });

      const takesByPrompt = new Map<string, { count: number; lastDate: string }>();
      for (const rec of speakerRecordings) {
        const prev = takesByPrompt.get(rec.promptId);
        if (!prev) {
          takesByPrompt.set(rec.promptId, { count: 1, lastDate: rec.createdAt });
        } else {
          takesByPrompt.set(rec.promptId, {
            count: prev.count + 1,
            lastDate: rec.createdAt > prev.lastDate ? rec.createdAt : prev.lastDate
          });
        }
      }

      let enriched: PromptWithStatus[] = basePrompts.map((p) => {
        const takeInfo = takesByPrompt.get(p.id);
        return {
          ...p,
          participantStatus: {
            completed: !!takeInfo,
            takesCount: takeInfo ? takeInfo.count : 0,
            lastRecordedAt: takeInfo ? takeInfo.lastDate : undefined
          }
        };
      });

      if (unrecordedOnly === 'true') {
        enriched = enriched.filter((p) => !p.participantStatus?.completed);
      }

      res.json(enriched);
      return;
    }

    res.json(basePrompts);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la récupération des phrases.', details: err?.message });
  }
});

// ============================================================================
// ROUTES D'AUTHENTIFICATION ADMINISTRATEUR (SÉCURITÉ & SESSION HTTPONLY)
// ============================================================================

// Helper options de cookie sécurisé (compatible même domaine & cross-domain HTTPS en production)
function getAdminCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSiteEnv = (process.env.COOKIE_SAMESITE || (isProd && process.env.CORS_ORIGIN ? 'none' : 'lax')).toLowerCase();
  const sameSite: 'lax' | 'strict' | 'none' =
    sameSiteEnv === 'none' ? 'none' : sameSiteEnv === 'strict' ? 'strict' : 'lax';
  return {
    httpOnly: true,
    sameSite,
    secure: isProd || sameSite === 'none',
    maxAge: 8 * 60 * 60 * 1000, // 8 heures
    path: '/'
  };
}

// POST /api/admin/login
router.post('/admin/login', (req: Request, res: Response): void => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip) || req.socket.remoteAddress || 'unknown';

  // 1. Vérification du blocage anti-bruteforce
  const blockStatus = isIpBlocked(ip);
  if (blockStatus.blocked) {
    res.status(429).json({
      error: `Trop de tentatives de connexion échouées. Compte temporairement verrouillé. Veuillez réessayer dans ${blockStatus.remainingSeconds} seconde(s).`,
      code: 'TOO_MANY_ATTEMPTS',
      retryAfter: blockStatus.remainingSeconds
    });
    return;
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: 'L\'identifiant et le mot de passe sont requis.' });
    return;
  }

  // 2. Vérification cryptographique des identifiants (timingSafeEqual)
  const isValid = verifyAdminCredentials(String(username), String(password));
  if (!isValid) {
    const failure = recordFailedLogin(ip);
    res.status(401).json({
      error: failure.isNowBlocked
        ? 'Trop de tentatives échouées. Compte temporairement verrouillé pour 15 minutes.'
        : `Identifiant ou mot de passe incorrect. ${failure.attemptsLeft} tentative(s) restante(s).`,
      code: 'INVALID_CREDENTIALS',
      attemptsLeft: failure.attemptsLeft
    });
    return;
  }

  // 3. Succès : réinitialisation des tentatives et création de session sécurisée
  resetLoginAttempts(ip);
  const session = createAdminSession(String(username), ip);

  // Cookie HttpOnly sécurisé
  res.cookie('gen_mina_admin_session', session.token, getAdminCookieOptions());

  res.json({
    success: true,
    message: 'Connexion administrateur réussie.',
    user: { username: session.username }
  });
});

// POST /api/admin/logout
router.post('/admin/logout', (req: Request, res: Response): void => {
  const token = req.cookies?.['gen_mina_admin_session'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  revokeAdminSession(token);
  const { maxAge: _maxAge, ...clearOpts } = getAdminCookieOptions();
  res.clearCookie('gen_mina_admin_session', clearOpts);
  res.json({ success: true, message: 'Déconnexion effectuée avec succès.' });
});

// GET /api/admin/me
router.get('/admin/me', (req: Request, res: Response): void => {
  const token = req.cookies?.['gen_mina_admin_session'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  const session = validateAdminSession(token);
  if (!session) {
    res.json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, username: session.username });
});

// POST /api/admin/security/reset-recovery-limits
router.post('/admin/security/reset-recovery-limits', requireAdminAuth, (req: Request, res: Response): void => {
  const targetIp = req.body?.ip || getClientIp(req);
  resetRecoveryAttempts(targetIp);
  res.json({ success: true, message: `Limites de tentatives réinitialisées pour l'IP ${targetIp}.` });
});

// ============================================================================
// COLLECTE AUDIO (AVEC TRANSACTION / NETTOYAGE ORPHELIN ROLLBACK)
// ============================================================================

// POST /api/recordings
router.post(
  '/recordings',
  upload.single('audio'),
  async (req: Request, res: Response): Promise<void> => {
    let uploadResult: { storageKey: string; audioUrl: string } | null = null;
    const storage = getAudioStorage();
    const repo = getMetadataRepository();

    try {
      if (!req.file) {
        res.status(400).json({ error: 'Aucun fichier audio n\'a été fourni.' });
        return;
      }

      if (req.file.size < 400) {
        res.status(400).json({
          error: 'Le fichier audio est trop court ou vide (taille inférieure à 400 octets).'
        });
        return;
      }

      // Validation Zod des métadonnées
      const parsedBody = recordingPayloadSchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({
          error: 'Données de formulaire invalides.',
          details: parsedBody.error.format()
        });
        return;
      }

      const {
        promptId,
        promptText,
        languageId,
        speakerId,
        consentGiven,
        consentVersion,
        durationSeconds
      } = parsedBody.data;

      // Vérification explicite du consentement déclaré
      if (consentGiven !== true && consentGiven !== 'true') {
        res.status(403).json({
          error: 'Le consentement explicite du participant est obligatoire pour enregistrer une prise.'
        });
        return;
      }

      // Vérification formelle du consentement côté serveur dans le registre persistant
      const consentStore = getConsentStore();
      const hasServerConsent = await consentStore.hasActiveConsent(speakerId);
      if (!hasServerConsent) {
        res.status(403).json({
          error: 'Aucun consentement valide ou actif trouvé côté serveur pour ce participant. Enregistrement refusé.'
        });
        return;
      }

      // Vérification de la langue
      const languageExists = LANGUAGES.some((l) => l.id === languageId);
      if (!languageExists) {
        res.status(400).json({
          error: `Langue inconnue ou non supportée : ${languageId}`
        });
        return;
      }

      // Calcul dynamique du numéro de prise (takeNumber)
      const takeNumber = await repo.getNextTakeNumber(promptId, speakerId);

      // Déduction de l'extension de fichier à partir du mimeType
      const rawMime = req.file.mimetype.toLowerCase();
      let ext = 'webm';
      if (rawMime.includes('wav')) ext = 'wav';
      else if (rawMime.includes('ogg')) ext = 'ogg';
      else if (rawMime.includes('mp4') || rawMime.includes('m4a')) ext = 'm4a';
      else if (rawMime.includes('mpeg') || rawMime.includes('mp3')) ext = 'mp3';

      const fileUid = crypto.randomBytes(6).toString('hex');
      const storageKey = `${languageId}/${promptId}/take_${takeNumber}_${Date.now()}_${fileUid}.${ext}`;

      // 1. Écriture réelle dans le stockage (R2 ou disque local)
      uploadResult = await storage.uploadAudio(
        storageKey,
        req.file.buffer,
        req.file.mimetype
      );

      const recordingId = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      const recordingMetadata: RecordingMetadata = {
        id: recordingId,
        promptId,
        promptText,
        languageId,
        takeNumber,
        speakerId,
        consentGiven: true,
        consentTimestamp: nowIso,
        consentVersion,
        audioStorageKey: uploadResult.storageKey,
        audioUrl: uploadResult.audioUrl,
        mimeType: req.file.mimetype,
        fileSizeBytes: req.file.size,
        durationSeconds: durationSeconds ? parseFloat(durationSeconds) : null,
        status: 'pending',
        storageBackend: storage.backendType,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      // 2. Sauvegarde des métadonnées dans Firestore (ou JSON persistant)
      await repo.saveRecording(recordingMetadata);


      res.status(201).json({
        success: true,
        message: 'Prise audio enregistrée avec succès.',
        recording: recordingMetadata
      });
    } catch (err: any) {
      console.error('[API] Erreur lors de l\'enregistrement de la prise :', err);

      // Rollback transactionnel : nettoyage immédiat du fichier audio orphelin
      if (uploadResult?.storageKey) {
        console.warn(`[Rollback] Nettoyage du fichier audio orphelin : ${uploadResult.storageKey}`);
        try {
          await storage.deleteAudio(uploadResult.storageKey);
        } catch (cleanupErr) {
          console.error('[Rollback] Échec de suppression de l\'audio orphelin :', cleanupErr);
        }
      }

      res.status(500).json({
        error: 'Erreur interne lors de la sauvegarde de la prise audio.',
        details: err?.message || String(err)
      });
    }
  }
);

// GET /api/recordings/audio/:key(*) - Streaming audio sécurisé avec support HTTP Range (Safari/iOS)
router.get('/recordings/audio/:key(*)', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawKey = typeof req.params.key === 'string' ? req.params.key : String(req.params.key || '');
    if (!rawKey) {
      res.status(400).json({ error: 'Clé audio manquante.' });
      return;
    }

    // Protection contre les failles de Directory Traversal
    const normalizedKey = path.normalize(rawKey).replace(/^(\.\.[\/\\])+/, '');
    const storage = getAudioStorage();

    // Support du header HTTP Range pour lecture/seek fiable sur Safari & iOS
    let requestedRange: { start: number; end?: number } | undefined;
    const rangeHeader = req.headers.range;
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : undefined;
      if (!Number.isNaN(start)) {
        requestedRange = { start, end: end !== undefined && !Number.isNaN(end) ? end : undefined };
      }
    }

    const { stream, mimeType, contentLength, totalSize, range } = await storage.getAudioStream(
      normalizedKey,
      requestedRange
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (range && totalSize !== undefined) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${totalSize}`);
      if (contentLength !== undefined) {
        res.setHeader('Content-Length', contentLength);
      }
    } else if (contentLength !== undefined) {
      res.setHeader('Content-Length', contentLength);
    }

    stream.pipe(res);
  } catch (err: any) {
    console.error('[Audio Stream] Erreur :', err);
    res.status(404).json({ error: 'Fichier audio introuvable.' });
  }
});

// ============================================================================
// ROUTES D'ADMINISTRATION PROTÉGÉES (REQUIRE ADMIN AUTH)
// ============================================================================

// GET /api/admin/recordings - Liste des enregistrements pour modération (PROTÉGÉ)
router.get('/admin/recordings', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const languageId = req.query.languageId as string | undefined;
    const status = req.query.status as string | undefined;
    const speakerId = req.query.speakerId as string | undefined;

    const repo = getMetadataRepository();
    const recordings = await repo.listRecordings({
      languageId,
      status,
      speakerId
    });

    res.json({
      total: recordings.length,
      recordings
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Erreur lors de la récupération des enregistrements.',
      details: err?.message
    });
  }
});

// PATCH /api/admin/recordings/:id - Validation ou rejet d'une prise (PROTÉGÉ)
router.patch(
  '/admin/recordings/:id',
  requireAdminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : String(req.params.id || '');
      const { status, rejectionReason, reviewedBy } = req.body;

      if (status !== 'validated' && status !== 'rejected') {
        res.status(400).json({
          error: 'Le statut doit être soit "validated" soit "rejected".'
        });
        return;
      }

      const adminUser = (req as any).adminUser || reviewedBy || 'admin';
      const repo = getMetadataRepository();
      const updated = await repo.updateRecordingStatus(id, {
        status,
        rejectionReason: rejectionReason || null,
        reviewedBy: adminUser,
        reviewedAt: new Date().toISOString()
      });

      if (!updated) {
        res.status(404).json({ error: 'Enregistrement introuvable.' });
        return;
      }

      res.json({
        success: true,
        message: `Prise marquée comme ${status === 'validated' ? 'validée' : 'rejetée'}.`,
        recording: updated
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'Erreur lors de la mise à jour de la prise.',
        details: err?.message
      });
    }
  }
);

// DELETE /api/recordings/:id & DELETE /api/admin/recordings/:id - Suppression unitaire (PROTÉGÉ)
router.delete(
  ['/recordings/:id', '/admin/recordings/:id'],
  requireAdminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : String(req.params.id || '');
      const repo = getMetadataRepository();
      const storage = getAudioStorage();

      const recording = await repo.getRecordingById(id);
      if (!recording) {
        res.status(404).json({ error: 'Enregistrement introuvable.' });
        return;
      }

      // 1. Supprimer le fichier audio du stockage
      try {
        await storage.deleteAudio(recording.audioStorageKey);
      } catch (err) {
        console.warn(
          `[Audio Deletion] Impossible de supprimer le fichier audio ${recording.audioStorageKey} :`,
          err
        );
      }

      // 2. Supprimer les métadonnées
      await repo.deleteRecording(id);

      res.json({
        success: true,
        message: 'Prise audio et métadonnées supprimées avec succès.'
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'Erreur lors de la suppression de la prise.',
        details: err?.message
      });
    }
  }
);

// POST /api/admin/prompts/import - Import d'un corpus de phrases validées (PROTÉGÉ)
router.post(
  '/admin/prompts/import',
  requireAdminAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = Array.isArray(req.body) ? req.body : req.body?.prompts;

      if (!payload || !Array.isArray(payload)) {
        res.status(400).json({
          error: 'Le format attendu est un tableau JSON de phrases ou un objet { prompts: [...] }.'
        });
        return;
      }

      const parseResult = importPromptsSchema.safeParse(payload);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Structure des phrases invalide.',
          details: parseResult.error.format()
        });
        return;
      }

      const result = await importPrompts(parseResult.data as Prompt[]);

      res.json({
        success: true,
        message: `${result.importedCount} phrase(s) importée(s) avec succès.`,
        importedCount: result.importedCount,
        totalCustomCount: result.totalCustomCount
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'Erreur lors de l\'import des phrases.',
        details: err?.message
      });
    }
  }
);

// GET /api/admin/export - Export des enregistrements validés (PROTÉGÉ)
router.get('/admin/export', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'json';
    const repo = getMetadataRepository();

    // Export uniquement des prises validées
    const validatedRecordings = await repo.listRecordings({ status: 'validated' });

    if (format === 'csv') {
      const headers = [
        'id',
        'languageId',
        'promptId',
        'promptText',
        'takeNumber',
        'speakerId',
        'audioStorageKey',
        'audioUrl',
        'mimeType',
        'fileSizeBytes',
        'durationSeconds',
        'status',
        'reviewedAt',
        'createdAt'
      ];

      const csvRows = [headers.join(',')];
      for (const r of validatedRecordings) {
        const row = [
          `"${r.id}"`,
          `"${r.languageId}"`,
          `"${r.promptId}"`,
          `"${(r.promptText || '').replace(/"/g, '""')}"`,
          r.takeNumber,
          `"${r.speakerId}"`,
          `"${r.audioStorageKey}"`,
          `"${r.audioUrl}"`,
          `"${r.mimeType}"`,
          r.fileSizeBytes,
          r.durationSeconds ?? '',
          `"${r.status}"`,
          `"${r.reviewedAt || ''}"`,
          `"${r.createdAt}"`
        ];
        csvRows.push(row.join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="gen_mina_dataset_validated_${Date.now()}.csv"`
      );
      res.send(csvRows.join('\n'));
      return;
    }

    // Par défaut format JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="gen_mina_dataset_validated_${Date.now()}.json"`
    );
    res.json({
      metadata: {
        exportedAt: new Date().toISOString(),
        totalValidated: validatedRecordings.length,
        version: '1.0.0'
      },
      recordings: validatedRecordings
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Erreur lors de l\'export des données.',
      details: err?.message
    });
  }
});

// ============================================================================
// ============================================================================
// GESTION DU CONSENTEMENT (RGPD & RÉCUPÉRATION SÉCURISÉE SANS TRACEUR)
// ============================================================================

// POST /api/consent - Enregistrement formel du consentement autonome avec Code de Récupération
router.post('/consent', async (req: Request, res: Response): Promise<void> => {
  try {
    const { speakerId, consentVersion } = req.body || {};
    if (!speakerId) {
      res.status(400).json({ error: 'L\'identifiant speakerId est requis.' });
      return;
    }

    const consentStore = getConsentStore();
    const existing = await consentStore.getConsent(String(speakerId));

    let recoveryCode: string;
    let recoveryCodeHash: string;

    if (existing && existing.recoveryCodeHash) {
      recoveryCodeHash = existing.recoveryCodeHash;
      recoveryCode = req.body?.recoveryCode?.trim().toUpperCase() || '(identifiant existant)';
    } else {
      recoveryCode = req.body?.recoveryCode?.trim().toUpperCase() || generateRecoveryCode();
      recoveryCodeHash = hashRecoveryCode(recoveryCode);
    }

    const nowIso = new Date().toISOString();
    const record: ConsentRecord = {
      speakerId: String(speakerId),
      recoveryCodeHash,
      consentGiven: true,
      consentVersion: String(consentVersion || 'v1.0-2026-10'),
      timestamp: nowIso,
      status: 'active'
    };

    await consentStore.saveConsent(record);

    // Retourner le code en clair UNE SEULE FOIS au participant pour conservation
    res.json({
      success: true,
      message: 'Consentement formel enregistré avec succès.',
      speakerId: record.speakerId,
      consentVersion: record.consentVersion,
      timestamp: record.timestamp,
      status: record.status,
      recoveryCode
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Erreur lors de l\'enregistrement du consentement.',
      details: err?.message
    });
  }
});

// GET /api/consent/:speakerId - Vérification du statut du consentement côté serveur (ne fuite aucun secret)
router.get('/consent/:speakerId', async (req: Request, res: Response): Promise<void> => {
  try {
    const speakerId = String(req.params.speakerId || '');
    const consentStore = getConsentStore();
    const record = await consentStore.getConsent(speakerId);
    if (!record || !record.consentGiven || record.status === 'revoked') {
      res.json({ consentGiven: false });
      return;
    }
    res.json({
      consentGiven: true,
      speakerId: record.speakerId,
      consentVersion: record.consentVersion,
      timestamp: record.timestamp,
      status: record.status
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Erreur lors de la vérification du consentement.',
      details: err?.message
    });
  }
});

// POST /api/consent/claim - Rétablissement de session via Code de Récupération (protégé contre la force brute)
router.post('/consent/claim', async (req: Request, res: Response): Promise<void> => {
  const clientIp = getClientIp(req);
  const rateCheck = isRecoveryBlocked(clientIp);
  if (rateCheck.blocked) {
    res.status(429).json({
      error: `Trop de tentatives de récupération infructueuses. Veuillez réessayer dans ${rateCheck.remainingSeconds} secondes.`
    });
    return;
  }

  try {
    const { recoveryCode } = req.body || {};
    if (!recoveryCode) {
      res.status(400).json({ error: 'Le code de récupération est requis.' });
      return;
    }

    const consentStore = getConsentStore();
    const record = await consentStore.getConsentByRecoveryCode(String(recoveryCode));
    if (!record || record.status === 'revoked') {
      const failure = recordFailedRecovery(clientIp);
      res.status(404).json({
        error: 'Code de récupération introuvable ou révoqué.',
        attemptsLeft: failure.attemptsLeft,
        isBlocked: failure.isNowBlocked
      });
      return;
    }

    // Réinitialisation du limiteur d'échecs après succès
    resetRecoveryAttempts(clientIp);

    res.json({
      success: true,
      message: 'Profil participant rétabli avec succès.',
      speakerId: record.speakerId,
      consent: {
        speakerId: record.speakerId,
        consentGiven: record.consentGiven,
        consentVersion: record.consentVersion,
        timestamp: record.timestamp,
        status: record.status
      }
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Erreur lors du rétablissement du profil.',
      details: err?.message
    });
  }
});

// POST /api/consent/revoke - Révocation du consentement et purge intégrale (par speakerId ou recoveryCode)
router.post(
  '/consent/revoke',
  async (req: Request, res: Response): Promise<void> => {
    const clientIp = getClientIp(req);
    let targetSpeakerId = req.body?.speakerId;
    const recoveryCode = req.body?.recoveryCode;

    // Si révocation par code de récupération, vérifier les limites de tentatives
    if (!targetSpeakerId && recoveryCode) {
      const rateCheck = isRecoveryBlocked(clientIp);
      if (rateCheck.blocked) {
        res.status(429).json({
          error: `Trop de tentatives infructueuses. Veuillez réessayer dans ${rateCheck.remainingSeconds} secondes.`
        });
        return;
      }

      const consentStore = getConsentStore();
      const found = await consentStore.getConsentByRecoveryCode(String(recoveryCode));
      if (found) {
        resetRecoveryAttempts(clientIp);
        targetSpeakerId = found.speakerId;
      } else {
        const failure = recordFailedRecovery(clientIp);
        res.status(404).json({
          error: 'Code de récupération introuvable.',
          attemptsLeft: failure.attemptsLeft
        });
        return;
      }
    }

    if (!targetSpeakerId) {
      res.status(400).json({ error: 'L\'identifiant speakerId ou le code de récupération est requis.' });
      return;
    }

    try {
      const repo = getMetadataRepository();
      const storage = getAudioStorage();
      const consentStore = getConsentStore();

      const userRecordings = await repo.listRecordings({ speakerId: targetSpeakerId });

      // 1. Suppression de tous les fichiers audio physiques
      for (const rec of userRecordings) {
        try {
          await storage.deleteAudio(rec.audioStorageKey);
        } catch (err) {
          console.warn(`[Revoke] Fichier ${rec.audioStorageKey} non supprimable :`, err);
        }
      }

      // 2. Suppression des métadonnées d'enregistrements en base
      const deletedCount = await repo.deleteRecordingsBySpeaker(targetSpeakerId);

      // 3. Suppression de l'enregistrement de consentement persistant
      await consentStore.revokeConsent(targetSpeakerId);

      res.json({
        success: true,
        message: `Consentement révoqué. ${deletedCount} prise(s) supprimée(s) définitivement.`
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'Erreur lors de la révocation du consentement.',
        details: err?.message
      });
    }
  }
);

export default router;
