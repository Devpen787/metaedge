#!/usr/bin/env bash
# One-shot MetaEdge setup for a fresh GCP e2-micro (Debian 12, always-free tier).
# Run AFTER cloning the repo to ~/metaedge:  bash ~/metaedge/scripts/gcp_setup.sh
set -euo pipefail

APP_DIR="$HOME/metaedge"
cd "$APP_DIR"
echo "== MetaEdge · GCP setup =="

# 1) Swap — the e2-micro has 1GB RAM; the build needs headroom.
if ! sudo swapon --show | grep -q /swapfile; then
  echo "-- adding 2G swap"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# 2) Node 22
if ! command -v node >/dev/null 2>&1; then
  echo "-- installing Node 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# 3) Caddy — automatic HTTPS reverse proxy
if ! command -v caddy >/dev/null 2>&1; then
  echo "-- installing Caddy"
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y caddy
fi

# 4) Build the app (skip puppeteer's Chromium — it's a dev tool)
echo "-- installing deps + building (a few minutes on the micro)"
export PUPPETEER_SKIP_DOWNLOAD=true
npm ci
npm run build

# 5) Production env (created once; COOKIE_SECRET generated, live trading OFF)
ENV_FILE="$APP_DIR/.env.production"
if [ ! -f "$ENV_FILE" ]; then
  {
    echo "NODE_ENV=production"
    echo "PORT=3000"
    echo "LIVE_EXECUTION_ENABLED=false"
    echo "COOKIE_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '=+/')"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

# 6) systemd service — always on, restarts on crash and on reboot
sudo tee /etc/systemd/system/metaedge.service >/dev/null <<UNIT
[Unit]
Description=MetaEdge
After=network.target

[Service]
User=$USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) $APP_DIR/dist/server.cjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now metaedge

# 7) HTTPS via Caddy on a free sslip.io hostname (real cert, no domain needed)
IP=$(curl -s -4 ifconfig.me)
HOST="${IP//./-}.sslip.io"
sudo tee /etc/caddy/Caddyfile >/dev/null <<CAD
$HOST {
  reverse_proxy localhost:3000
}
CAD
sudo systemctl reload caddy

# 8) Daily db backup (7-day rotation), 3am
(crontab -l 2>/dev/null | grep -v metaedge-backup; \
 echo "0 3 * * * cp $APP_DIR/data/db.json $APP_DIR/data/db-backup-\$(date +\%u).json 2>/dev/null # metaedge-backup") | crontab -

sleep 2
STATUS=$(systemctl is-active metaedge)
echo
echo "=============================================="
echo "  MetaEdge is $STATUS."
echo "  URL:  https://$HOST"
echo "  (first visit may take ~30s while the HTTPS certificate is issued)"
echo
echo "  Optional one-time step — live market data for guests:"
echo "    cd ~/metaedge && ./node_modules/.bin/mm login browser --no-wait"
echo "    ...then open the printed link in YOUR browser and sign in."
echo
echo "  Update to latest code later:"
echo "    bash ~/metaedge/scripts/gcp_update.sh"
echo "=============================================="
