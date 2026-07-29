# Deploy MetaEdge on Google Cloud (always-free e2-micro)

Cost: **$0/month** on Google's always-free tier (one e2-micro VM in a US region,
30GB disk, ~1GB/month of traffic — plenty for a friends beta). A card is
required on the account, but the free-tier VM doesn't charge it.

## Your part (one time, ~15 minutes)

### 1 · Create the VM
1. Go to https://console.cloud.google.com → create a project (e.g. `metaedge`).
2. Menu → **Compute Engine → VM instances** → Enable the API → **Create instance**.
3. Settings that matter (everything else: defaults):
   - **Name:** `metaedge`
   - **Region:** `us-central1` (or `us-west1` / `us-east1` — only these are free)
   - **Machine type:** Series **E2** → **e2-micro** (look for "your first 720 hours free")
   - **Boot disk:** Debian 12, **30 GB**, *Standard* persistent disk
   - **Firewall:** check ✅ **Allow HTTP traffic** and ✅ **Allow HTTPS traffic**
4. Create. Wait ~30s for the green check.

### 2 · Make a GitHub token (repo is private)
1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate.
2. Repository access: **Only select repositories** → `Devpen787/metaedge`.
3. Permissions: **Contents → Read-only**. Generate, copy the token.

### 3 · Run the setup
1. In the VM list, click **SSH** (opens a terminal in your browser).
2. Paste this, press enter, and paste your token when asked (it won't echo):

```bash
sudo apt-get update -qq && sudo apt-get install -y -qq git && \
read -s -p "GitHub token: " GT && echo && \
git clone -b claude/backend-buildout "https://${GT}@github.com/Devpen787/metaedge.git" ~/metaedge && \
bash ~/metaedge/scripts/gcp_setup.sh
```

(The token prompt hides what you type/paste — blank screen is normal. If the
token ever leaks in plain text, revoke it on GitHub and mint a new one.)

3. ~5–8 minutes later it prints your URL: `https://<ip>.sslip.io` — that's the
   link you share. (First visit can take ~30s while the HTTPS certificate is
   issued. If the certificate ever refuses to issue — sslip.io shares
   rate limits globally — the fix is a $12/yr domain pointed at the VM's IP;
   change one line in `/etc/caddy/Caddyfile`.)

### 4 · Optional: live market data for guests
On the VM: `cd ~/metaedge && ./node_modules/.bin/mm login browser --no-wait`,
open the printed link in **your own** browser, sign in with your MetaMask
account. This login serves only public lookups (quotes/markets for people who
haven't connected their own wallet yet). Skip it and those bits show
"unavailable" until players connect — everything else works.

## Afterwards

| Task | How |
|---|---|
| Update to latest code | SSH → `bash ~/metaedge/scripts/gcp_update.sh` |
| Watch logs | SSH → `journalctl -u metaedge -f` |
| Restart | SSH → `sudo systemctl restart metaedge` |
| Backups | automatic: daily `data/db-backup-<weekday>.json` (7-day rotation) |
| Live trading | stays OFF (`LIVE_EXECUTION_ENABLED=false` in `~/metaedge/.env.production`) |

## What the setup script does (for the curious)
2G swap (build headroom on 1GB RAM) → Node 22 → Caddy (auto-HTTPS) → `npm ci`
+ build → generated `COOKIE_SECRET`, live trading off → systemd service
(starts on boot, restarts on crash) → HTTPS on a free sslip.io hostname →
daily db backup cron.
