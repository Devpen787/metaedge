#!/usr/bin/env bash
set -euo pipefail

metaedge_release_dir="${METAEDGE_RELEASE_DIR:-$(pwd)}"
metaedge_legacy_dir="${METAEDGE_LEGACY_APP_DIR:-$HOME/metaedge}"
metaedge_shared_dir="${METAEDGE_SHARED_DIR:-$HOME/metaedge-shared}"
metaedge_pg_secret="${METAEDGE_POSTGRES_SECRET_FILE:-$HOME/.config/metaedge/postgres.env}"
metaedge_source_db="${METAEDGE_SOURCE_DB:-$metaedge_legacy_dir/data/db.json}"
metaedge_unit="/etc/systemd/system/metaedge.service"
metaedge_commit="$(git -C "$metaedge_release_dir" rev-parse --short HEAD)"
metaedge_stamp="$(date -u +%Y%m%dT%H%M%SZ)"

test -f "$metaedge_source_db"
test -f "$metaedge_pg_secret"
test -f "$metaedge_release_dir/dist/server.cjs"
test -f "$metaedge_release_dir/dist/postgres_worker.cjs"
mkdir -p "$metaedge_shared_dir/backups"

cp "$metaedge_source_db" "$metaedge_shared_dir/backups/db-before-postgres-$metaedge_stamp.json"
chmod 600 "$metaedge_shared_dir/backups/db-before-postgres-$metaedge_stamp.json"
sync "$metaedge_shared_dir/backups/db-before-postgres-$metaedge_stamp.json"
sha256sum "$metaedge_shared_dir/backups/db-before-postgres-$metaedge_stamp.json" \
  > "$metaedge_shared_dir/backups/db-before-postgres-$metaedge_stamp.sha256"

sudo cp "$metaedge_unit" "$metaedge_shared_dir/backups/metaedge.service.before-postgres-$metaedge_stamp"
crontab -l > "$metaedge_shared_dir/backups/crontab.before-postgres-$metaedge_stamp" 2>/dev/null || true
crontab -l 2>/dev/null | grep -v 'auto_deploy.sh' | crontab - || true

rollback() {
  echo "cutover failed; restoring prior service" >&2
  sudo cp "$metaedge_shared_dir/backups/metaedge.service.before-postgres-$metaedge_stamp" "$metaedge_unit"
  if [ -s "$metaedge_shared_dir/backups/crontab.before-postgres-$metaedge_stamp" ]; then
    crontab "$metaedge_shared_dir/backups/crontab.before-postgres-$metaedge_stamp"
  fi
  sudo systemctl daemon-reload
  sudo systemctl restart metaedge || true
}
trap rollback ERR

sudo systemctl stop metaedge
# shellcheck disable=SC1090
source "$metaedge_pg_secret"
export METAEDGE_POSTGRES_ADMIN_URL="$DATABASE_URL"
export METAEDGE_POSTGRES_WORKER_PATH="$metaedge_release_dir/dist/postgres_worker.cjs"

npm --prefix "$metaedge_release_dir" run postgres:import -- \
  "$metaedge_shared_dir/backups/db-before-postgres-$metaedge_stamp.json"
npm --prefix "$metaedge_release_dir" run postgres:export -- \
  "$metaedge_shared_dir/backups/db-postgres-export-$metaedge_stamp.json"
npm --prefix "$metaedge_release_dir" run postgres:compare -- \
  "$metaedge_shared_dir/backups/db-before-postgres-$metaedge_stamp.json" \
  "$metaedge_shared_dir/backups/db-postgres-export-$metaedge_stamp.json"

metaedge_runtime_env="$metaedge_shared_dir/metaedge.env"
umask 077
grep -vE '^(DATABASE_URL|METAEDGE_POSTGRES_|METAEDGE_ALLOW_PRODUCTION_SQLITE|GIT_COMMIT|LIVE_EXECUTION_ENABLED|DECISION_RUNTIME_DISABLED|V5_DECISION_WRITER_ENABLED)=' \
  "$metaedge_legacy_dir/.env.production" > "$metaedge_runtime_env"
{
  echo "DATABASE_URL=$DATABASE_URL"
  echo "METAEDGE_POSTGRES_POOL_MAX=2"
  echo "METAEDGE_POSTGRES_STATEMENT_TIMEOUT_MS=60000"
  echo "METAEDGE_POSTGRES_IDLE_TIMEOUT_MS=30000"
  echo "METAEDGE_POSTGRES_SYNC_TIMEOUT_MS=90000"
  echo "METAEDGE_POSTGRES_WORKER_PATH=$metaedge_release_dir/dist/postgres_worker.cjs"
  echo "GIT_COMMIT=$metaedge_commit"
  echo "LIVE_EXECUTION_ENABLED=false"
  echo "DECISION_RUNTIME_DISABLED=false"
  echo "V5_DECISION_WRITER_ENABLED=true"
} >> "$metaedge_runtime_env"
chmod 600 "$metaedge_runtime_env"

sudo tee "$metaedge_unit" >/dev/null <<UNIT
[Unit]
Description=MetaEdge V5 paper research
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=$(id -un)
WorkingDirectory=$metaedge_release_dir
EnvironmentFile=$metaedge_runtime_env
Environment=DECISION_RUNTIME_DISABLED=false
Environment=V5_DECISION_WRITER_ENABLED=true
Environment=OPPORTUNITY_FACTORY_DISABLED=true
Environment=FAST_PERP_RECORDER_ENABLED=false
Environment=FAST_PERP_OPERATION_ENABLED=false
Environment=FAST_PERP_RESEARCH_ENABLED=false
ExecStart=$(command -v node) $metaedge_release_dir/dist/server.cjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl restart metaedge

metaedge_health=""
for _ in $(seq 1 90); do
  metaedge_health="$(curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null || true)"
  if [ -n "$metaedge_health" ]; then break; fi
  sleep 1
done
HEALTH_JSON="$metaedge_health" EXPECTED_COMMIT="$metaedge_commit" node --input-type=module <<'NODE'
const health = JSON.parse(process.env.HEALTH_JSON || '{}');
if (health.status !== 'ok') throw new Error('CUTOVER_HEALTH_NOT_OK');
if (health.commit !== process.env.EXPECTED_COMMIT) throw new Error('CUTOVER_COMMIT_MISMATCH');
if (health.storage?.backend !== 'postgres') throw new Error('CUTOVER_NOT_POSTGRES');
if (health.storage?.schemaVersion !== 5) throw new Error('CUTOVER_SCHEMA_NOT_V5');
if (health.liveModeGlobalLock !== true) throw new Error('CUTOVER_LIVE_LOCK_OPEN');
console.log(JSON.stringify({
  status: health.status,
  commit: health.commit,
  storage: health.storage,
  users: health.users,
  liveModeGlobalLock: health.liveModeGlobalLock,
}));
NODE

(crontab -l 2>/dev/null | grep -v 'gcp_postgres_backup.sh'; \
  echo "0 3 * * * METAEDGE_RELEASE_DIR=$metaedge_release_dir bash $metaedge_release_dir/scripts/gcp_postgres_backup.sh >> $metaedge_shared_dir/postgres-backup.log 2>&1 # metaedge-postgres-backup") \
  | crontab -

trap - ERR
echo "MetaEdge V5 PostgreSQL cutover complete: commit=$metaedge_commit backup_stamp=$metaedge_stamp live_locked=true"
