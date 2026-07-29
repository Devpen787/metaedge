#!/bin/zsh
set -eu

if (( $# != 1 )); then
  print -u2 'usage: run_fast_perp_final_server.sh LOG_PATH'
  exit 64
fi

cd /Users/devinsonpena/Documents/metaedge-gemini

exec env \
  PORT=3000 \
  NODE_ENV=production \
  COOKIE_SECRET=flywheel-recovery-final \
  LIVE_EXECUTION_ENABLED=false \
  LIVE_REVIEW_EXECUTION_CERTIFIED=false \
  FAST_PERP_RECORDER_ENABLED=true \
  FAST_PERP_OPERATION_ENABLED=true \
  FAST_PERP_SIGNAL_ENABLED=true \
  FAST_PERP_RESOLVER_ENABLED=true \
  FAST_PERP_RESEARCH_ENABLED=false \
  FAST_PERP_LIFECYCLE_ENABLED=true \
  /opt/homebrew/bin/node dist/server.cjs >> "$1" 2>&1
