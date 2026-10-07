#!/usr/bin/env bash
# Respaldo lógico de MongoDB (mongodump comprimido) con retención por días.
#
#   DATABASE_URL="mongodb+srv://…" BACKUP_DIR=/var/backups/consultorio ./scripts/backup.sh
#
# Variables:
#   DATABASE_URL     cadena de conexión (obligatoria; se lee también de .env)
#   BACKUP_DIR       carpeta destino (por defecto ./backups)
#   RETENTION_DAYS   días a conservar (por defecto 30)
#   BACKUP_GPG_RECIPIENT  si se define, cifra el archivo con GPG para ese destinatario
#
# Producción: programe este script cada noche (cron / GitHub Actions / job del
# proveedor) Y copie el archivo fuera del servidor (S3, Backblaze, Drive). Un
# respaldo que vive en el mismo disco que la base de datos no es un respaldo.
# Si usa MongoDB Atlas, active además los "Cloud Backups" con restauración a un
# punto en el tiempo; este script es la segunda copia, independiente del proveedor.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" && -f .env ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)"
fi
: "${DATABASE_URL:?Defina DATABASE_URL}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

command -v mongodump >/dev/null || { echo "Falta mongodump (MongoDB Database Tools)"; exit 1; }

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/consultorio-$STAMP.archive.gz"

echo "→ Respaldando en $FILE"
mongodump --uri="$DATABASE_URL" --archive="$FILE" --gzip

if [[ -n "${BACKUP_GPG_RECIPIENT:-}" ]]; then
  gpg --batch --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" --output "$FILE.gpg" "$FILE"
  rm -f "$FILE"
  FILE="$FILE.gpg"
fi

# Integrity check: the archive must be listable before we trust it.
if [[ "$FILE" == *.gz ]]; then
  mongorestore --archive="$FILE" --gzip --dryRun --quiet >/dev/null 2>&1 \
    || { echo "✗ El respaldo no pasó la verificación"; exit 1; }
fi

find "$BACKUP_DIR" -name 'consultorio-*.archive.gz*' -mtime "+$RETENTION_DAYS" -delete
echo "✓ Respaldo listo: $FILE ($(du -h "$FILE" | cut -f1))"

# Restaurar (¡sobre una base vacía o de prueba primero!):
#   mongorestore --uri="$DATABASE_URL" --archive=consultorio-XXXX.archive.gz --gzip --drop
