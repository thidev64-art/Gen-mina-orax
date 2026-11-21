import { Request } from 'express';

interface RecoveryRateLimitRecord {
  failedAttempts: number;
  firstAttemptAt: number;
  blockedUntil: number;
}

// Maximum 5 tentatives échouées de code de récupération
const MAX_RECOVERY_ATTEMPTS = 5;
// Blocage temporaire de 15 minutes en cas de dépassement
const RECOVERY_LOCKOUT_MS = 15 * 60 * 1000;

const ipRecoveryAttempts = new Map<string, RecoveryRateLimitRecord>();

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown-ip';
}

/**
 * Vérifie si une adresse IP est bloquée pour les tentatives de code de récupération.
 */
export function isRecoveryBlocked(ip: string): { blocked: boolean; remainingSeconds: number } {
  const record = ipRecoveryAttempts.get(ip);
  if (!record) return { blocked: false, remainingSeconds: 0 };

  const now = Date.now();
  if (record.blockedUntil > now) {
    const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { blocked: true, remainingSeconds };
  }

  // Si le délai de blocage est écoulé, réinitialiser
  if (record.blockedUntil > 0 && record.blockedUntil <= now) {
    ipRecoveryAttempts.delete(ip);
    return { blocked: false, remainingSeconds: 0 };
  }

  return { blocked: false, remainingSeconds: 0 };
}

/**
 * Enregistre un échec de validation de code de récupération pour une IP.
 */
export function recordFailedRecovery(ip: string): {
  attemptsLeft: number;
  isNowBlocked: boolean;
  remainingSeconds: number;
} {
  const now = Date.now();
  let record = ipRecoveryAttempts.get(ip);

  if (!record) {
    record = { failedAttempts: 1, firstAttemptAt: now, blockedUntil: 0 };
    ipRecoveryAttempts.set(ip, record);
    return {
      attemptsLeft: MAX_RECOVERY_ATTEMPTS - 1,
      isNowBlocked: false,
      remainingSeconds: 0
    };
  }

  record.failedAttempts += 1;

  if (record.failedAttempts >= MAX_RECOVERY_ATTEMPTS) {
    record.blockedUntil = now + RECOVERY_LOCKOUT_MS;
    return {
      attemptsLeft: 0,
      isNowBlocked: true,
      remainingSeconds: Math.ceil(RECOVERY_LOCKOUT_MS / 1000)
    };
  }

  return {
    attemptsLeft: MAX_RECOVERY_ATTEMPTS - record.failedAttempts,
    isNowBlocked: false,
    remainingSeconds: 0
  };
}

/**
 * Réinitialise le compteur après un succès de récupération ou de claim.
 */
export function resetRecoveryAttempts(ip: string): void {
  ipRecoveryAttempts.delete(ip);
}
