#!/usr/bin/env bash
set -euo pipefail

metaedge_release_dir="${METAEDGE_RELEASE_DIR:-$(pwd)}"
metaedge_shared_dir="${METAEDGE_SHARED_DIR:-$HOME/metaedge-shared}"
metaedge_pg_secret="${METAEDGE_POSTGRES_SECRET_FILE:-$HOME/.config/metaedge/postgres.env}"
metaedge_backup_dir="$metaedge_shared_dir/backups/postgres"
metaedge_stamp="$(date -u +%Y%m%dT%H%M%SZ)"

test -f "$metaedge_pg_secret"
mkdir -p "$metaedge_backup_dir"
chmod 700 "$metaedge_backup_dir"
# shellcheck disable=SC1090
source "$metaedge_pg_secret"
export METAEDGE_POSTGRES_ADMIN_URL="$DATABASE_URL"
npm --prefix "$metaedge_release_dir" run postgres:export -- \
  "$metaedge_backup_dir/metaedge-state-$metaedge_stamp.json"
chmod 600 "$metaedge_backup_dir/metaedge-state-$metaedge_stamp.json"
sha256sum "$metaedge_backup_dir/metaedge-state-$metaedge_stamp.json" \
  > "$metaedge_backup_dir/metaedge-state-$metaedge_stamp.sha256"

echo "PostgreSQL logical backup complete: $metaedge_stamp"
