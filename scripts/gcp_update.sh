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
echo "-- restarting"
sudo systemctl restart metaedge
sleep 2
systemctl is-active metaedge && echo "✅ MetaEdge updated and running."
