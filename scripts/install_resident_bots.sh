#!/usr/bin/env bash
# Resident arena bots: a short battle every 30 minutes keeps the board alive
# AND continuously exercises the product end-to-end — every run re-verifies
# sessions, trading, wallet actions, leagues, and leaderboard integrity, and
# exits non-zero into the log if anything breaks. The same four bots return
# each run (persistent identities in data/arena-bots.json).
set -euo pipefail
APP_DIR="${1:-$HOME/metaedge}"
( crontab -l 2>/dev/null | grep -v arena-bots; \
  echo "*/30 * * * * cd $APP_DIR && $(command -v node) scripts/arena_bots.mjs --bots 4 --rounds 6 --interval 8000 >> data/bots.log 2>&1 # arena-bots" ) | crontab -
echo "✅ Resident bots installed — a 6-round battle every 30 minutes."
echo "   Watch:  tail -f $APP_DIR/data/bots.log"
echo "   Remove: crontab -l | grep -v arena-bots | crontab -"
