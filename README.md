# Gen/Mina — Plateforme de Collecte Vocale pour la Langue Mina (Gẽ gbe)

Plateforme web ouverte et éthique dédiée à la collecte, la modération et l'exportation de corpus vocaux en **Mina (Gẽ gbe)** et en **Français** pour la recherche en intelligence artificielle vocale (STT / TTS).

---

## Architecture du Monorepo

```text
mina/
├── backend/          # API REST Express + TypeScript (ESM)
│   ├── src/
│   │   ├── adapters/     # Connecteurs STT / TTS (V2)
│   │   ├── data/         # Langues, phrases de base & PromptStore (Firestore / Local)
│   │   ├── repository/   # Métadonnées & ConsentStore (Firestore / Local)
│   │   ├── routes/       # Routes API REST (/api/*)
│   │   ├── security/     # Auth admin (HttpOnly, timingSafeEqual) & rate-limiting
│   │   └── storage/      # Stockage audio (Cloudflare R2 / Disque local, HTTP Range)
│   └── data/             # Corpus certifié Mina UDHR & stockage local dev
├── frontend/         # SPA React 19 + TypeScript + Vite
│   └── src/
│       ├── components/   # LandingView, CollectStudio, ProgressionView, AdminView, Modales
│       └── lib/api.ts    # Client API compatible proxy local & VITE_API_URL en prod
└── shared/           # Types TypeScript de référence
```

---

## Démarrage Rapide en Local

### 1. Installer les dépendances
```bash
npm install
npm run install:all
```

### 2. Configurer l'environnement (optionnel en local)
Copier `backend/.env.example` vers `backend/.env` si vous souhaitez personnaliser les variables.
Sans clé Cloudflare R2 ni Firestore, le backend bascule automatiquement en mode **disque local persistant** (`backend/data/`).

### 3. Lancer Backend + Frontend
```bash
npm run dev
```
* **Frontend** : http://localhost:5173
* **Backend API** : http://localhost:5000 (`/api/health`)
* **Administration** : http://localhost:5173/admin

---

## Tests & Build

```bash
# Build complet (Backend + Frontend)
npm run build

# Lint Frontend
npm --prefix frontend run lint

# Suite d'intégration Backend (avec le serveur démarré)
cd backend && npx tsx src/test_flow.ts
```

---

## Déploiement Production

* **Backend** : renseigner `NODE_ENV=production`, `ADMIN_PASSWORD`, `CORS_ORIGIN`, `COOKIE_SAMESITE=none` (si domaines distincts), ainsi que les variables **Cloudflare R2** et **Google Cloud Firestore** (voir `backend/.env.example`).
* **Frontend** : renseigner `VITE_API_URL` pointant vers l'URL publique de l'API (voir `frontend/.env.example`) et activer le fallback SPA (`/* -> /index.html`).

