#!/usr/bin/env bash
# First-time setup for a fresh Ubuntu 22.04/24.04 droplet.
# Safe to re-run — every step is idempotent.
#
# Usage (run as root on the droplet):
#   bash <(curl -fsSL https://raw.githubusercontent.com/gatispriede/react-web-cms/master/scripts/server-init.sh)
#
# After the script finishes:
#   1. Edit /opt/cms/.env  (fill in all required values)
#   2. docker compose -f /opt/cms/compose.yaml up --build -d
set -euo pipefail

REPO_URL="https://github.com/gatispriede/react-web-cms.git"
APP_DIR="/opt/cms"

echo "=== [1/5] System update & base packages ==="
apt-get update -qq
apt-get install -y -qq curl git ufw

echo "=== [2/5] Install Docker Engine + Compose plugin ==="
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
else
    echo "Docker already installed — skipping"
fi

systemctl enable --now docker

if ! docker compose version &>/dev/null; then
    apt-get install -y -qq docker-compose-plugin
fi

echo "=== [3/5] Clone / update repository ==="
if [[ -d "$APP_DIR/.git" ]]; then
    echo "Repo already present — pulling latest"
    git -C "$APP_DIR" pull origin master
else
    git clone "$REPO_URL" "$APP_DIR"
fi

echo "=== [4/5] Firewall (UFW) ==="
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"
ufw --force enable
ufw status verbose

echo "=== [5/5] Environment file ==="
if [[ ! -f "$APP_DIR/.env" ]]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    echo ""
    echo "============================================================"
    echo "  ACTION REQUIRED: edit $APP_DIR/.env before starting."
    echo ""
    echo "  Minimum values to fill:"
    echo "    NEXTAUTH_SECRET   -> openssl rand -base64 32"
    echo "    NEXTAUTH_URL      -> http://46.101.220.131  (or your domain)"
    echo "    MONGODB_URI       -> mongodb://mongodb:27017"
    echo "    MONGODB_DB        -> MAIN-DB"
    echo "    ADMIN_EMAIL"
    echo "    ADMIN_DEFAULT_PASSWORD"
    echo "    BCRYPT_ROUNDS     -> 12"
    echo "    BUILD_PORT        -> 3000"
    echo "============================================================"
    echo ""
else
    echo ".env already exists — not overwriting"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. nano $APP_DIR/.env"
echo "  2. docker compose -f $APP_DIR/compose.yaml up --build -d"
echo "  3. docker compose -f $APP_DIR/compose.yaml logs -f   # verify startup"
echo ""
echo "After first manual start, GitHub Actions handles all future deploys."
