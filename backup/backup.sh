#!/bin/sh
# Dumps MongoDB, encrypts the dump at rest, and prunes backups older than
# RETENTION_DAYS. Requires mongodump and openssl (both present in the
# mongo:7 image this script is designed to run inside).
set -eu

: "${MONGO_URI:?MONGO_URI is required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
archive="${BACKUP_DIR}/kupidon-${timestamp}.archive.gz"
encrypted="${archive}.enc"

cleanup() {
  rm -f "$archive"
}
trap cleanup EXIT

mongodump --uri="$MONGO_URI" --archive="$archive" --gzip

openssl enc -aes-256-cbc -pbkdf2 -salt \
  -pass "pass:${BACKUP_PASSPHRASE}" \
  -in "$archive" -out "$encrypted"

echo "Backup written to $encrypted"

deleted=$(find "$BACKUP_DIR" -name 'kupidon-*.archive.gz.enc' -mtime "+${RETENTION_DAYS}" -print -delete)
if [ -n "$deleted" ]; then
  echo "Pruned backups older than ${RETENTION_DAYS} days:"
  echo "$deleted"
fi
