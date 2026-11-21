# ============================================================
# Gen/Mina Backend — Dockerfile Production (Fly.io / Cloud)
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage runtime léger
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY data/mina_udhr_corpus.json ./data/mina_udhr_corpus.json
COPY data/mina_corpus_template.json ./data/mina_corpus_template.json

RUN mkdir -p /data/uploads

EXPOSE 8080

CMD ["node", "dist/index.js"]
