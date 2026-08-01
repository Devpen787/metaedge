#!/usr/bin/env bash
set -euo pipefail

metaedge_shared_dir="${METAEDGE_SHARED_DIR:-$HOME/metaedge-shared}"
metaedge_stamp="${1:?usage: gcp_v5_postgres_rollback.sh <backup-stamp>}"
metaedge_unit_backup="$metaedge_shared_dir/backups/metaedge.service.before-postgres-$metaedge_stamp"
metaedge_cron_backup="$metaedge_shared_dir/backups/crontab.before-postgres-$metaedge_stamp"

test -f "$metaedge_unit_backup"
sudo cp "$metaedge_unit_backup" /etc/systemd/system/metaedge.service
if [ -s "$metaedge_cron_backup" ]; then crontab "$metaedge_cron_backup"; fi
sudo systemctl daemon-reload
sudo systemctl restart metaedge
sleep 2
systemctl is-active --quiet metaedge
curl -fsS http://127.0.0.1:3000/api/health
echo
echo "MetaEdge service rolled back to the pre-PostgreSQL release; PostgreSQL data was preserved."
