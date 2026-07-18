#!/bin/zsh
set -eu

if (( $# != 2 )); then
  print -u2 'usage: run_fast_perp_final_monitor.sh SERVER_PID LOG_PATH'
  exit 64
fi

cd /Users/devinsonpena/Documents/metaedge-gemini

exec env \
  SOAK_DURATION_MS=86400000 \
  SOAK_INTERVAL_MS=15000 \
  SOAK_STAGE=final \
  METAEDGE_PID="$1" \
  METAEDGE_URL=http://127.0.0.1:3000 \
  /opt/homebrew/bin/node scripts/fast_perp_soak_monitor.mjs >> "$2" 2>&1
