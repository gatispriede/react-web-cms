#!/usr/bin/env bash
# First-time setup for a fresh Ubuntu 22.04/24.04 droplet.
# Safe to re-run — every step is idempotent.
#
# Usage (run as root on the droplet):
#   bash <(curl -fsSL https://raw.githubusercontent.com/gatispriede/react-web-cms/master/scripts/server-init.sh)
#
# Optional env vars:
#   DOMAIN   — your domain name (e.g. funisimo.pro). If not set, SSL is skipped.
#   EMAIL    — email for Let's Encrypt notifications.
#
# Example with domain:
#   DOMAIN=funisimo.pro EMAIL=you@example.com bash <(curl -fsSL ...)
set -euo pipefail

REPO_URL="https://github.com/gatispriede/react-web-cms.git"
APP_DIR="/opt/cms"
DOMAIN="${DOMAIN:-}"
LE_EMAIL="${EMAIL:-}"

# ─── 1. System update & base packages ────────────────────────────────────────
echo "=== [1/7] System update & base packages ==="
apt-get update -qq
apt-get install -y -qq curl git ufw nginx certbot python3-certbot-nginx

# ─── 2. Swap (2 GB) — Next.js build needs it on small droplets ───────────────
echo "=== [2/7] Swap ==="
if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
    echo "Swap created (2 GB)"
else
    echo "Swap already exists — skipping"
fi

# ─── 3. Docker Engine + Compose plugin ───────────────────────────────────────
echo "=== [3/7] Docker ==="
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
else
    echo "Docker already installed — skipping"
fi
systemctl enable --now docker
if ! docker compose version &>/dev/null; then
    apt-get install -y -qq docker-compose-plugin
fi

# ─── 4. Clone / update repository ────────────────────────────────────────────
echo "=== [4/7] Repository ==="
if [[ -d "$APP_DIR/.git" ]]; then
    echo "Repo already present — pulling latest"
    git -C "$APP_DIR" config pull.rebase false
    git -C "$APP_DIR" fetch origin
    git -C "$APP_DIR" reset --hard origin/master
else
    git clone "$REPO_URL" "$APP_DIR"
    git -C "$APP_DIR" config pull.rebase false
fi

# ─── 5. Persistent upload directories ────────────────────────────────────────
echo "=== [5/7] Upload directories ==="
mkdir -p "$APP_DIR/uploads/images"
mkdir -p "$APP_DIR/uploads/bundles"
# `design-v2` is the legacy name for the per-site theme bundle folder.
# `bundles` is the generic replacement; both are bind-mounted so existing
# content URLs (/design-v2/*) keep resolving while references migrate.
mkdir -p "$APP_DIR/uploads/design-v2"
echo "Upload directories ready at $APP_DIR/uploads/"

# ─── 6. Firewall ─────────────────────────────────────────────────────────────
echo "=== [6/7] Firewall (UFW) ==="
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"
ufw --force enable

# ─── 7. Nginx + SSL ──────────────────────────────────────────────────────────
echo "=== [7/7] Nginx ==="

# Write Nginx config (HTTP only initially; certbot upgrades to HTTPS)
if [[ -n "$DOMAIN" ]]; then
    cat > /etc/nginx/sites-available/cms <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    ln -sf /etc/nginx/sites-available/cms /etc/nginx/sites-enabled/cms
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl enable nginx && systemctl restart nginx

    if [[ -n "$LE_EMAIL" ]]; then
        echo "Requesting SSL certificate for $DOMAIN (www.$DOMAIN)..."
        certbot --nginx \
            -d "$DOMAIN" -d "www.$DOMAIN" \
            --non-interactive --agree-tos \
            -m "$LE_EMAIL" \
            --redirect
        echo "SSL certificate installed. Auto-renewal enabled."
    else
        echo "DOMAIN set but EMAIL not set — skipping SSL. Run manually:"
        echo "  certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m you@example.com --redirect"
    fi
else
    # No domain — just proxy HTTP to the app
    cat > /etc/nginx/sites-available/cms <<'EOF'
server {
    listen 80 default_server;
    location / {
        proxy_pass http://127.0.0.1:3080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    ln -sf /etc/nginx/sites-available/cms /etc/nginx/sites-enabled/cms
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl enable nginx && systemctl restart nginx
    echo "Nginx proxying HTTP → app (no domain/SSL configured)"
fi

# ─── Environment file ─────────────────────────────────────────────────────────
if [[ ! -f "$APP_DIR/.env" ]]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    # Set production defaults
    sed -i "s|^MONGODB_URI=.*|MONGODB_URI=mongodb://mongodb:27017|" "$APP_DIR/.env"
    sed -i "s|^MONGODB_DB=.*|MONGODB_DB=MAIN-DB|" "$APP_DIR/.env"
    sed -i "s|^BUILD_PORT=.*|BUILD_PORT=3000|" "$APP_DIR/.env"
    sed -i "s|^BCRYPT_ROUNDS=.*|BCRYPT_ROUNDS=12|" "$APP_DIR/.env"
    # Generate a random NEXTAUTH_SECRET
    SECRET=$(openssl rand -base64 32)
    sed -i "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$SECRET|" "$APP_DIR/.env"
    if [[ -n "$DOMAIN" ]]; then
        sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=https://$DOMAIN|" "$APP_DIR/.env"
    fi
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "    1. Edit $APP_DIR/.env — fill in:"
echo "         ADMIN_EMAIL"
echo "         ADMIN_DEFAULT_PASSWORD"
if [[ -z "$DOMAIN" ]]; then
echo "         NEXTAUTH_URL  (https://yourdomain.com)"
fi
echo ""
echo "    2. Start the stack:"
echo "         docker compose -f $APP_DIR/infra/compose.yaml up --build -d"
echo ""
echo "  After first start, GitHub Actions handles all future deploys."
echo "================================================================"
