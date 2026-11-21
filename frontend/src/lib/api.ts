/**
 * Client API centralisé pour Gen/Mina.
 * - En développement local : utilise les chemins relatifs '/api/...' (via le proxy Vite).
 * - En production séparée : utilise la variable d'environnement VITE_API_URL (ex: https://api.genmina.org).
 */
const RAW_API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return RAW_API_BASE ? `${RAW_API_BASE}${normalizedPath}` : normalizedPath;
}

export function resolveAudioUrl(audioUrl: string): string {
  return apiUrl(audioUrl);
}

