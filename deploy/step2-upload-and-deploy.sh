#!/usr/bin/env bash
# monitor-ai deploy to 101.37.84.238 (runs from WSL / Git Bash)
set -euo pipefail

SERVER="root@101.37.84.238"
PASSWORD="9neK2yU~r&st*&9"
REMOTE_DIR="/opt/monitor-ai"
PROJECT="D:\\monitor-ai"

echo "========================================"
echo " monitor-ai Deploy to 101.37.84.238"
echo "========================================"

# Check sshpass
HAS_PASS=n
command -v sshpass &>/dev/null && HAS_PASS=y

SSH_CMD="ssh -o StrictHostKeyChecking=no"
SCP_CMD="scp -o StrictHostKeyChecking=no"
if [ "$HAS_PASS" = "y" ]; then
    SSH_CMD="sshpass -p '$PASSWORD' ssh -o StrictHostKeyChecking=no"
    SCP_CMD="sshpass -p '$PASSWORD' scp -o StrictHostKeyChecking=no"
else
    echo "WARNING: sshpass not found. You'll be prompted for password repeatedly."
    echo "  Install: sudo apt install sshpass  (Linux/WSL)"
    echo "  Or: brew install sshpass          (macOS)"
fi

run_ssh() {
    if [ "$HAS_PASS" = "y" ]; then
        eval "$SSH_CMD $SERVER '$1'"
    else
        $SSH_CMD $SERVER "$1"
    fi
}

run_scp() {
    if [ "$HAS_PASS" = "y" ]; then
        eval "$SCP_CMD $1 $SERVER:$2"
    else
        $SCP_CMD $1 $SERVER:$2
    fi
}

# Phase 1: Server initialization
echo ""
echo "[1/6] Server initialization..."
run_ssh "
set -e
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl wget git nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs
mkdir -p $REMOTE_DIR/public $REMOTE_DIR/.next/static
id -u monitorai &>/dev/null || useradd -m -s /bin/bash monitorai
chown monitorai:monitorai $REMOTE_DIR
echo 'Node: \$(node --version), npm: \$(npm --version)'
"

# Phase 2: Upload build artifacts
echo ""
echo "[2/6] Uploading build artifacts..."
echo "  Uploading standalone server..."
run_scp "${PROJECT}/.next/standalone/*" "${REMOTE_DIR}/"
echo "  Uploading public assets..."
run_scp "${PROJECT}/public/*" "${REMOTE_DIR}/public/"
echo "  Uploading static assets..."
run_ssh "mkdir -p ${REMOTE_DIR}/.next"
run_scp -r "${PROJECT}/.next/static/*" "${REMOTE_DIR}/.next/static/"
echo "  Uploading Nginx config..."
run_scp "${PROJECT}/deploy/nginx-monitor-ai.conf" "/tmp/nginx-monitor-ai.conf"

# Phase 3: Install production deps
echo ""
echo "[3/6] Installing production dependencies..."
run_ssh "cd $REMOTE_DIR && npm install --production"

# Phase 4: Configure Nginx
echo ""
echo "[4/6] Configuring Nginx..."
run_ssh "
cp /tmp/nginx-monitor-ai.conf /etc/nginx/sites-available/monitor-ai
ln -sf /etc/nginx/sites-available/monitor-ai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
"

# Phase 5: SSL Certificate
echo ""
echo "[5/6] Obtaining SSL certificate..."
run_ssh "certbot --nginx -d monitor-ai.vip -d www.monitor-ai.vip --non-interactive --agree-tos --email admin@monitor-ai.vip"

# Phase 6: PM2
echo ""
echo "[6/6] Starting with PM2..."
run_ssh "
npm install -g pm2
cd $REMOTE_DIR
PORT=3000 pm2 start server.js --name monitor-ai
pm2 save
pm2 startup systemd -u root --hp /root
"

# Verify
echo ""
echo "========================================"
echo " Deployment Complete!"
echo "========================================"
echo ""
echo "Verifying..."
run_ssh "pm2 status && echo '---' && curl -sI http://localhost:3000 | head -5"
echo ""
echo "Visit: https://monitor-ai.vip"
