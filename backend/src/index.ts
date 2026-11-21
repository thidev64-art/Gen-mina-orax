import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import apiRouter from './routes/api.js';
import { getAudioStorage } from './storage/index.js';
import { getMetadataRepository } from './repository/index.js';
import { getConsentStore } from './repository/ConsentStore.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Trust reverse proxy (Render, Railway, Cloud Run, Nginx, Cloudflare) pour req.ip et cookies Secure
app.set('trust proxy', 1);

// Origines CORS autorisées (liste séparée par des virgules dans CORS_ORIGIN)
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Requêtes sans origine (curl, tests serveur, healthchecks)
      if (!origin) {
        return callback(null, true);
      }
      // En développement local, autoriser localhost et 127.0.0.1
      if (!isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (!isProduction && allowedOrigins.length === 0) {
        return callback(null, true);
      }
      return callback(new Error(`Origine CORS non autorisée : ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health / root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Gen/Mina Voice Collection API',
    version: '1.0.0',
    documentation: '/api/health'
  });
});

// Enregistrement des routes API
app.use('/api', apiRouter);

// Gestionnaire d'erreurs global
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[Global Error]', err);
    res.status(err.status || 500).json({
      error: err.message || 'Une erreur serveur inattendue est survenue.'
    });
  }
);

// Vérification sécurité en production
if (isProduction && !process.env.ADMIN_PASSWORD) {
  console.error(
    '[Sécurité CRITIQUE] ADMIN_PASSWORD doit être défini en environnement de production !'
  );
  process.exit(1);
}

// Initialisation et démarrage (0.0.0.0 requis pour Docker / Fly.io)
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  const storage = getAudioStorage();
  const repo = getMetadataRepository();
  const consentStore = getConsentStore();

  console.log('====================================================');
  console.log(`🚀 Serveur Gen/Mina démarré sur http://${HOST}:${PORT}`);
  console.log(`📦 Stockage Audio actif       : ${storage.backendType}`);
  console.log(`🗄️  Dépôt Métadonnées actif    : ${repo.backendType}`);
  console.log(`🔐 Registre Consentements     : ${consentStore.backendType}`);
  console.log('====================================================');
});

export default app;
