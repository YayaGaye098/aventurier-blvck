# Aventurier Blvck : une seule image = site Angular compilé + API FastAPI.

# ── 1. Construction du site Angular ─────────────────────
FROM node:22-alpine AS front
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npx ng build

# ── 2. API Python qui sert aussi le site ────────────────
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./
COPY --from=front /app/frontend/dist/frontend/browser /app/frontend/dist/frontend/browser
RUN chmod +x docker-entrypoint.sh \
    && useradd --create-home --uid 1000 app \
    && mkdir -p /var/data && chown -R app:app /app /var/data

# Données persistantes (base + photos/vidéos) : disque monté sur /var/data (voir render.yaml).
ENV DATA_DIR=/var/data \
    DATABASE_URL=sqlite:////var/data/aventurier.db \
    UPLOAD_DIR=/var/data/uploads \
    PORT=8000

USER app
EXPOSE 8000
CMD ["./docker-entrypoint.sh"]
