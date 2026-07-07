#!/usr/bin/env bash
# Auto-deploy: poll GitHub and, if the tracked branch advanced, run the (fast)
# gcp_update.sh. Invoked by cron every ~2 min on the VM. Outbound git only — no
# inbound SSH, no secrets. A flock guards against overlapping runs (a deploy that
# does npm ci can take minutes).
set -uo pipefail
REPO="$HOME/metaedge"
cd "$REPO" || exit 1

exec 9>/tmp/metaedge-autodeploy.lock
flock -n 9 || exit 0   # a deploy is already in progress — skip this tick

git fetch --quiet origin 2>/dev/null || { echo "$(date -Is) fetch failed"; exit 0; }
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse '@{u}' 2>/dev/null) || { echo "$(date -Is) no upstream configured"; exit 0; }
[ "$LOCAL" = "$REMOTE" ] && exit 0   # already up to date, nothing to do

echo "$(date -Is) new commit detected ($LOCAL -> $REMOTE) — deploying"
bash scripts/gcp_update.sh
echo "$(date -Is) deploy finished (now $(git rev-parse --short HEAD))"
