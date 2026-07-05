#!/usr/bin/env bash
# Update MetaEdge on the GCP VM to the latest code and restart. Game data
# (data/db.json, wallet profiles) is untouched.
set -euo pipefail
cd "$HOME/metaedge"
echo "-- pulling latest"
git pull --ff-only
echo "-- rebuilding"
export PUPPETEER_SKIP_DOWNLOAD=true
npm ci
npm run build
# Stamp the deployed commit into .env.production so /api/health reports it.
COMMIT=$(git rev-parse --short HEAD)
ENV_FILE="$HOME/metaedge/.env.production"
touch "$ENV_FILE"
grep -v '^GIT_COMMIT=' "$ENV_FILE" > "$ENV_FILE.tmp" 2>/dev/null || true
echo "GIT_COMMIT=$COMMIT" >> "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
echo "-- restarting (commit $COMMIT)"
sudo systemctl restart metaedge
sleep 2
systemctl is-active metaedge && echo "✅ MetaEdge updated and running."
