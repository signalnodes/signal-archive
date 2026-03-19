#!/bin/sh
# Signal Archive — VPS setup from scratch.
#
# Prerequisites:
#   - Fresh Hetzner VPS (Debian/Ubuntu)
#   - Tailscale installed and joined to tailnet
#   - SSH access as root
#   - .env file ready (copy from password manager or previous backup)
#
# Usage:
#   1. SSH into VPS
#   2. Run this script:
#        curl -sL https://raw.githubusercontent.com/signalnodes/signal-archive/main/deploy/vps-setup.sh | sh
#      Or clone first and run locally:
#        git clone git@github.com:signalnodes/signal-archive.git /opt/signal-archive
#        sh /opt/signal-archive/deploy/vps-setup.sh
#
# After running:
#   1. Copy .env to /opt/signal-archive/.env
#   2. Import Chrome cookies (see scripts/import-cookies.ts)
#   3. Start the stack:
#        docker compose --env-file /opt/signal-archive/.env -f deploy/docker-compose.yml build
#        docker compose --env-file /opt/signal-archive/.env -f deploy/docker-compose.yml up -d
#   4. Verify: docker compose -f deploy/docker-compose.yml logs ingest -f

set -e

PROJECT_DIR="/opt/signal-archive"

echo "=== Signal Archive VPS Setup ==="

# ── Install Docker ──────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "[setup] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
else
  echo "[setup] Docker already installed"
fi

# ── Install socat (useful for debugging) ────────────────────────────────────
if ! command -v socat >/dev/null 2>&1; then
  echo "[setup] Installing socat..."
  apt-get install -y socat
fi

# ── Clone repo ──────────────────────────────────────────────────────────────
if [ ! -d "$PROJECT_DIR/.git" ]; then
  echo "[setup] Cloning repo to $PROJECT_DIR..."
  git clone git@github.com:signalnodes/signal-archive.git "$PROJECT_DIR"
else
  echo "[setup] Repo already exists, pulling latest..."
  cd "$PROJECT_DIR" && git pull
fi

cd "$PROJECT_DIR"

# ── Backup cron ─────────────────────────────────────────────────────────────
CRON_LINE="0 6 * * * sh $PROJECT_DIR/deploy/backup-chrome-profile.sh >> /var/log/chrome-backup.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "backup-chrome-profile"; then
  echo "[setup] Adding daily Chrome profile backup cron (06:00 UTC)..."
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
else
  echo "[setup] Backup cron already exists"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Copy your .env file to $PROJECT_DIR/.env"
echo "  2. Build images:  docker compose --env-file $PROJECT_DIR/.env -f deploy/docker-compose.yml build"
echo "  3. Start stack:   docker compose --env-file $PROJECT_DIR/.env -f deploy/docker-compose.yml up -d"
echo "  4. Import Chrome cookies (see scripts/import-cookies.ts)"
echo "  5. Verify logs:   docker compose -f deploy/docker-compose.yml logs ingest -f"
echo ""
echo "Key files:"
echo "  .env                  — secrets (never commit)"
echo "  deploy/docker-compose.yml — service definitions"
echo "  deploy/chrome-start.sh    — Chrome + CDP proxy entrypoint"
echo "  deploy/chrome-proxy.cjs   — Host header rewriting proxy"
echo ""
