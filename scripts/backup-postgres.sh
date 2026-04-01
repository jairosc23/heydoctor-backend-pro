#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────
# HeyDoctor PostgreSQL Backup Script
# pg_dump → gzip → S3. Pensado para Railway / Postgres con TLS (libpq).
# ─────────────────────────────────────────────

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="heydoctor_${TIMESTAMP}.sql.gz"
TMP_DIR="${TMP_DIR:-/tmp}"
TMP_PLAIN="${TMP_DIR}/heydoctor_${TIMESTAMP}.sql"
BACKUP_PATH="${TMP_DIR}/${BACKUP_FILE}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
S3_PREFIX="s3://${BACKUP_BUCKET}/postgres"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Si la URL no incluye sslmode, añadimos require (típico en Railway / gestionados).
normalize_database_url() {
  local url="$1"
  url="${url#"${url%%[![:space:]]*}"}"
  url="${url%"${url##*[![:space:]]}"}"
  if [[ -z "${url}" ]]; then
    echo ""
    return
  fi
  if [[ "${url}" =~ sslmode= ]]; then
    echo "${url}"
    return
  fi
  case "${url}" in
    *\?*) echo "${url}&sslmode=require" ;;
    *)    echo "${url}?sslmode=require" ;;
  esac
}

if [ -z "${DATABASE_URL:-}" ]; then
  log "ERROR: DATABASE_URL is not set (secreto GitHub; usar la URL pública de Railway PostgreSQL)"
  exit 1
fi

if [ -z "${BACKUP_BUCKET:-}" ]; then
  log "ERROR: BACKUP_BUCKET is not set"
  exit 1
fi

DATABASE_URL_EFFECTIVE="$(normalize_database_url "${DATABASE_URL}")"
if [ -z "${DATABASE_URL_EFFECTIVE}" ]; then
  log "ERROR: DATABASE_URL quedó vacía tras normalizar"
  exit 1
fi

export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-30}"

AWS_ARGS=""
if [ -n "${AWS_ENDPOINT_URL:-}" ]; then
  AWS_ARGS="--endpoint-url ${AWS_ENDPOINT_URL}"
fi

log "Starting backup (pg_dump --dbname, SSL según URL)..."
if ! pg_dump \
  --no-owner \
  --no-privileges \
  --dbname="${DATABASE_URL_EFFECTIVE}" \
  --file="${TMP_PLAIN}"; then
  log "ERROR: pg_dump falló. Revisa DATABASE_URL, sslmode, acceso de red GitHub→Railway y credenciales."
  rm -f "${TMP_PLAIN}"
  exit 1
fi

if ! gzip -c "${TMP_PLAIN}" > "${BACKUP_PATH}"; then
  log "ERROR: gzip falló"
  rm -f "${TMP_PLAIN}" "${BACKUP_PATH}"
  exit 1
fi
rm -f "${TMP_PLAIN}"

FILESIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
log "Backup created: ${BACKUP_FILE} (${FILESIZE})"

log "Uploading to ${S3_PREFIX}/${BACKUP_FILE}..."
aws s3 cp "${BACKUP_PATH}" "${S3_PREFIX}/${BACKUP_FILE}" ${AWS_ARGS}
log "Upload complete"

rm -f "${BACKUP_PATH}"

log "Rotating backups older than ${RETENTION_DAYS} days..."
CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d)

aws s3 ls "${S3_PREFIX}/" ${AWS_ARGS} | while read -r line; do
  FILE_DATE=$(echo "$line" | awk '{print $1}')
  FILE_NAME=$(echo "$line" | awk '{print $4}')
  if [ -z "${FILE_NAME}" ]; then continue; fi
  if [[ "${FILE_DATE}" < "${CUTOFF_DATE}" ]]; then
    log "Deleting old backup: ${FILE_NAME}"
    aws s3 rm "${S3_PREFIX}/${FILE_NAME}" ${AWS_ARGS}
  fi
done

log "Backup complete"
