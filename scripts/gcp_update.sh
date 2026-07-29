#!/usr/bin/env bash
# Update MetaEdge on the GCP VM to the latest code and restart. Game data
# (data/db.json, wallet profiles) is untouched.
set -euo pipefail
cd "$HOME/metaedge"
export PUPPETEER_SKIP_DOWNLOAD=true

PREV=$(git rev-parse HEAD)
echo "-- pulling latest"
git pull --ff-only

# `npm ci` takes ~12 min on the e2-micro, but most deploys are code-only. Only
# reinstall when the lockfile actually changed (or node_modules is missing/broken,
# or FORCE_INSTALL=1). This turns a code-only deploy from ~13 min into ~1 min.
if [ "${FORCE_INSTALL:-0}" = 1 ] || [ ! -d node_modules ] || ! git diff --quiet "$PREV" HEAD -- package.json package-lock.json; then
  echo "-- dependencies changed → npm ci (this is the slow one)"
  npm ci
else
  echo "-- dependencies unchanged → skipping npm ci"
fi

echo "-- building"
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
