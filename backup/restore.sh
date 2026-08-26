#!/bin/sh
# Decrypts an encrypted backup archive and restores it into MONGO_URI,
# dropping existing collections that appear in the dump first. Destructive
# by design — this is a disaster-recovery restore, not a merge.
set -eu

: "${MONGO_URI:?MONGO_URI is required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"
BACKUP_FILE="${1:?Usage: restore.sh <path-to-backup.archive.gz.enc>}"

decrypted=$(mktemp)
cleanup() {
  rm -f "$decrypted"
}
trap cleanup EXIT

openssl enc -d -aes-256-cbc -pbkdf2 \
  -pass "pass:${BACKUP_PASSPHRASE}" \
  -in "$BACKUP_FILE" -out "$decrypted"

mongorestore --uri="$MONGO_URI" --archive="$decrypted" --gzip --drop

echo "Restore from $BACKUP_FILE complete"
