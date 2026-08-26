#!/bin/sh
# Runs backup.sh on a fixed interval. A simple sleep loop rather than cron —
# the mongo:7 image doesn't bundle a cron daemon and installing one just for
# this would be more moving parts than the schedule needs.
set -eu

INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"

echo "Backup scheduler starting: running every ${INTERVAL}s"

while true; do
  if ! /scripts/backup.sh; then
    echo "Backup failed at $(date -u -Iseconds)" >&2
  fi
  sleep "$INTERVAL"
done
