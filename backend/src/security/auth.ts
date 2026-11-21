import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface AdminSession {
  token: string;
  username: string;
  createdAt: number;
  expiresAt: number;
  ip: string;
}

// Durée de session : 8 heures
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

// Rate limiting : max 5 tentatives échouées, blocage 15 minutes
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// Stockage en mémoire des sessions actives
const activeSessions = new Map<string, AdminSession>();

// Stockage en mémoire des tentatives par IP
interface RateLimitRecord {
  attempts: number;
  firstAttemptAt: number;
  blockedUntil: number;
}
const ipAttempts = new Map<string, RateLimitRecord>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown-ip';
}

/**
 * Vérifie si une IP est temporairement bloquée après trop d'échecs.
 */
export function isIpBlocked(ip: string): { blocked: boolean; remainingSeconds: number } {
  const record = ipAttempts.get(ip);
  if (!record) return { blocked: false, remainingSeconds: 0 };

  const now = Date.now();
  if (record.blockedUntil > now) {
    const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { blocked: true, remainingSeconds };
  }

  // Déblocage automatique si le délai est expiré
  if (record.blockedUntil > 0 && record.blockedUntil <= now) {
    ipAttempts.delete(ip);
    return { blocked: false, remainingSeconds: 0 };
  }

  return { blocked: false, remainingSeconds: 0 };
}

/**
 * Enregistre un échec de connexion pour une IP et applique le blocage si seuil atteint.
 */
export function recordFailedLogin(ip: string): { attemptsLeft: number; isNowBlocked: boolean; remainingSeconds: number } {
  const now = Date.now();
  let record = ipAttempts.get(ip);

  if (!record) {
    record = { attempts: 1, firstAttemptAt: now, blockedUntil: 0 };
    ipAttempts.set(ip, record);
    return { attemptsLeft: MAX_FAILED_ATTEMPTS - 1, isNowBlocked: false, remainingSeconds: 0 };
  }

  record.attempts += 1;

  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.blockedUntil = now + LOCKOUT_DURATION_MS;
    return {
      attemptsLeft: 0,
      isNowBlocked: true,
      remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000)
    };
  }

  return {
    attemptsLeft: MAX_FAILED_ATTEMPTS - record.attempts,
    isNowBlocked: false,
    remainingSeconds: 0
  };
}

/**
 * Réinitialise le compteur d'échecs après un succès.
 */
export function resetLoginAttempts(ip: string): void {
  ipAttempts.delete(ip);
}

/**
 * Crée une nouvelle session administrateur sécurisée.
 */
export function createAdminSession(username: string, ip: string): AdminSession {
  // Purge périodique des sessions expirées
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt <= now) {
      activeSessions.delete(token);
    }
  }

  const token = crypto.randomBytes(32).toString('hex');
  const session: AdminSession = {
    token,
    username,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
    ip
  };

  activeSessions.set(token, session);
  return session;
}

/**
 * Valide un jeton de session existant.
 */
export function validateAdminSession(token?: string): AdminSession | null {
  if (!token) return null;

  const session = activeSessions.get(token);
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt <= now) {
    activeSessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Révoque une session administrateur.
 */
export function revokeAdminSession(token?: string): void {
  if (token) {
    activeSessions.delete(token);
  }
}

/**
 * Middleware Express : vérifie l'authentification administrateur.
 * Rejette avec HTTP 401 si non authentifié.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token =
    req.cookies?.['gen_mina_admin_session'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '');

  const session = validateAdminSession(token);

  if (!session) {
    res.status(401).json({
      error: 'Authentification requise pour accéder aux fonctions d\'administration.',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  (req as any).adminUser = session.username;
  next();
}

/**
 * Récupère les identifiants administrateur configurés dans l'environnement.
 */
export function getAdminCredentials(): { username: string; passwordHash: string; plainPasswordExpected: string } {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const plainPasswordExpected =
    process.env.ADMIN_PASSWORD ||
    (process.env.NODE_ENV === 'production' ? '' : 'GenMina2026!Securite');

  if (!plainPasswordExpected) {
    throw new Error('ADMIN_PASSWORD non configuré sur le serveur.');
  }

  const passwordHash = crypto.createHash('sha256').update(plainPasswordExpected).digest('hex');
  return { username, passwordHash, plainPasswordExpected };
}

/**
 * Vérifie les identifiants fournis (protection contre les attaques temporelles via timingSafeEqual).
 */
export function verifyAdminCredentials(usernameInput: string, passwordInput: string): boolean {
  const { username, plainPasswordExpected } = getAdminCredentials();

  const userMatch = usernameInput.trim() === username;
  if (!userMatch) return false;

  const inputHash = crypto.createHash('sha256').update(passwordInput).digest();
  const expectedHash = crypto.createHash('sha256').update(plainPasswordExpected).digest();

  return crypto.timingSafeEqual(inputHash, expectedHash);
}
