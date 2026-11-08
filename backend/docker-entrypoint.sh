#!/bin/sh
# Démarrage du conteneur (Render ou Docker).
set -e

DATA_DIR="${DATA_DIR:-/var/data}"
UPLOAD_DIR="${UPLOAD_DIR:-$DATA_DIR/uploads}"
mkdir -p "$UPLOAD_DIR"

# Premier démarrage sur un disque vide : on y copie les photos fournies avec le site,
# puis on crée l'admin (ADMIN_USERNAME / ADMIN_PASSWORD) et le contenu de départ.
if [ ! -f "$DATA_DIR/.initialise" ]; then
  echo "Premier démarrage : préparation du disque $DATA_DIR"
  cp -rn /app/backend/uploads/. "$UPLOAD_DIR"/ 2>/dev/null || true
  if [ -n "$ADMIN_USERNAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
    python seed.py --admin "$ADMIN_USERNAME" --password "$ADMIN_PASSWORD" --demo
  else
    echo "ATTENTION : ADMIN_USERNAME / ADMIN_PASSWORD non définis, aucun admin créé."
  fi
  touch "$DATA_DIR/.initialise"
fi

# --proxy-headers : Render est un proxy HTTPS, on récupère la vraie IP et le https.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" \
  --proxy-headers --forwarded-allow-ips="*" --workers 1
