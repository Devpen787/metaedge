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

# 5) PostgreSQL canonical state (local persistent disk, least-privilege app role)
METAEDGE_REPO_DIR="$APP_DIR" bash "$APP_DIR/scripts/gcp_postgres_provision.sh"
# shellcheck disable=SC1090
source "$HOME/.config/metaedge/postgres.env"
DATABASE_URL="$APP_DIR/data/db.json" npm run postgres:bootstrap-file
METAEDGE_POSTGRES_ADMIN_URL="$DATABASE_URL" npm run postgres:import -- "$APP_DIR/data/db.json"

# 6) Production env (created once; COOKIE_SECRET generated, live trading OFF)
ENV_FILE="$APP_DIR/.env.production"
if [ ! -f "$ENV_FILE" ]; then
  {
    echo "NODE_ENV=production"
    echo "PORT=3000"
    echo "LIVE_EXECUTION_ENABLED=false"
    echo "COOKIE_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '=+/')"
    echo "DATABASE_URL=$DATABASE_URL"
    echo "METAEDGE_POSTGRES_POOL_MAX=2"
    echo "METAEDGE_POSTGRES_STATEMENT_TIMEOUT_MS=60000"
    echo "METAEDGE_POSTGRES_IDLE_TIMEOUT_MS=30000"
    echo "METAEDGE_POSTGRES_SYNC_TIMEOUT_MS=90000"
    echo "METAEDGE_POSTGRES_WORKER_PATH=$APP_DIR/dist/postgres_worker.cjs"
    echo "DECISION_RUNTIME_DISABLED=false"
    echo "V5_DECISION_WRITER_ENABLED=true"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

# 7) systemd service — always on, restarts on crash and on reboot
sudo tee /etc/systemd/system/metaedge.service >/dev/null <<UNIT
[Unit]
Description=MetaEdge
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=$USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
Environment=DECISION_RUNTIME_DISABLED=false
Environment=V5_DECISION_WRITER_ENABLED=true
Environment=OPPORTUNITY_FACTORY_DISABLED=true
Environment=FAST_PERP_RECORDER_ENABLED=false
Environment=FAST_PERP_OPERATION_ENABLED=false
Environment=FAST_PERP_RESEARCH_ENABLED=false
ExecStart=$(command -v node) $APP_DIR/dist/server.cjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable metaedge
sudo systemctl restart metaedge || true
echo "-- app service: $(systemctl is-active metaedge)"

# 8) HTTPS via Caddy on a free sslip.io hostname (real cert, no domain needed).
# IP from GCP's metadata server (always reachable), external lookup as fallback.
echo "-- configuring HTTPS"
IP=$(curl -s -H "Metadata-Flavor: Google" "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip" || true)
[ -z "$IP" ] && IP=$(curl -s -4 --max-time 10 ifconfig.me || true)
[ -z "$IP" ] && { echo "!! could not determine external IP — configure /etc/caddy/Caddyfile manually"; IP="0.0.0.0"; }
HOST="${IP//./-}.sslip.io"
sudo tee /etc/caddy/Caddyfile >/dev/null <<CAD
$HOST {
  reverse_proxy localhost:3000
}
CAD
sudo systemctl reload caddy

# 9) Daily logical PostgreSQL backup, 3am
(crontab -l 2>/dev/null | grep -v metaedge-backup; \
 echo "0 3 * * * METAEDGE_RELEASE_DIR=$APP_DIR bash $APP_DIR/scripts/gcp_postgres_backup.sh >> $APP_DIR/postgres-backup.log 2>&1 # metaedge-backup") | crontab -

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
