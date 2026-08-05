# Step 2: Upload build artifacts and configure server
# 密码通过环境变量 MONITOR_AI_SERVER_PASSWORD 注入（见本地机密备忘文件），
# 未设置时 sshpass 不可用将回退为交互式输入。
$ErrorActionPreference = "Stop"
$SERVER_IP = $env:MONITOR_AI_SERVER_IP
if (-not $SERVER_IP) { $SERVER_IP = Read-Host "请输入服务器 IP" }
$SERVER = "root@$SERVER_IP"
$PASSWORD = $env:MONITOR_AI_SERVER_PASSWORD
$REMOTE_DIR = "/opt/monitor-ai"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " monitor-ai Deploy to $SERVER_IP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# --- Check sshpass availability ---
$HAS_SSHPASS = ($null -ne (Get-Command sshpass -ErrorAction SilentlyContinue)) -and (-not [string]::IsNullOrEmpty($PASSWORD))
$SSH_BASE = if ($HAS_SSHPASS) { "sshpass -p '$PASSWORD' ssh -o StrictHostKeyChecking=no" } else { "ssh -o StrictHostKeyChecking=no" }
$SCP_BASE = if ($HAS_SSHPASS) { "sshpass -p '$PASSWORD' scp -o StrictHostKeyChecking=no" } else { "scp -o StrictHostKeyChecking=no" }

if (-not $HAS_SSHPASS) {
    Write-Host "WARNING: sshpass not found or MONITOR_AI_SERVER_PASSWORD not set." -ForegroundColor Red
    Write-Host "  Set `$env:MONITOR_AI_SERVER_PASSWORD or install sshpass for non-interactive deploy." -ForegroundColor Yellow
    Write-Host "Without it, you'll be prompted for the password repeatedly." -ForegroundColor Red
}

# --- Helper functions ---
function Invoke-SSH($cmd) {
    if ($HAS_SSHPASS) {
        Invoke-Expression "$SSH_BASE $SERVER `"$cmd`""
    } else {
        ssh -o StrictHostKeyChecking=no $SERVER $cmd
    }
}

function Invoke-SCP($local, $remote) {
    if ($HAS_SSHPASS) {
        Invoke-Expression "$SCP_BASE $local $SERVER`:$remote"
    } else {
        scp -o StrictHostKeyChecking=no $local $SERVER`:$remote
    }
}

# ============================================================
# PHASE 1: Server initialization
# ============================================================
Write-Host "`n[Phase 1/6] Server initialization..." -ForegroundColor Yellow

Invoke-SSH @"
set -e
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget git nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs
mkdir -p /opt/monitor-ai /opt/monitor-ai/public /opt/monitor-ai/.next/static
id -u monitorai &>/dev/null || useradd -m -s /bin/bash monitorai
chown monitorai:monitorai /opt/monitor-ai
echo "Node: \$(node --version), npm: \$(npm --version)"
"@

# ============================================================
# PHASE 2: Upload build artifacts
# ============================================================
Write-Host "`n[Phase 2/6] Uploading build artifacts..." -ForegroundColor Yellow

$PROJECT = "D:\monitor-ai"

Write-Host "  Uploading standalone server..." -ForegroundColor Gray
Invoke-SCP "$PROJECT\.next\standalone\*" "$REMOTE_DIR/"
Invoke-SSH "mkdir -p $REMOTE_DIR/.next"

Write-Host "  Uploading public assets..." -ForegroundColor Gray
Invoke-SCP "$PROJECT\public\*" "$REMOTE_DIR/public/"

Write-Host "  Uploading static assets..." -ForegroundColor Gray
Invoke-SSH "mkdir -p $REMOTE_DIR/.next"
Invoke-SCP -r "$PROJECT\.next\static\*" "$REMOTE_DIR/.next/static/"

Write-Host "  Uploading Nginx config..." -ForegroundColor Gray
Invoke-SCP "$PROJECT\deploy\nginx-monitor-ai.conf" "/tmp/nginx-monitor-ai.conf"

# ============================================================
# PHASE 3: Install production deps on server
# ============================================================
Write-Host "`n[Phase 3/6] Installing production dependencies..." -ForegroundColor Yellow
Invoke-SSH "cd $REMOTE_DIR && npm install --production"

# ============================================================
# PHASE 4: Configure Nginx
# ============================================================
Write-Host "`n[Phase 4/6] Configuring Nginx..." -ForegroundColor Yellow
Invoke-SSH @"
cp /tmp/nginx-monitor-ai.conf /etc/nginx/sites-available/monitor-ai
ln -sf /etc/nginx/sites-available/monitor-ai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "Nginx configured OK"
"@

# ============================================================
# PHASE 5: SSL Certificate (Certbot)
# ============================================================
Write-Host "`n[Phase 5/6] Obtaining SSL certificate..." -ForegroundColor Yellow
Write-Host "  This may take a moment (DNS must resolve to $SERVER)..." -ForegroundColor Gray
Invoke-SSH @"
certbot --nginx -d monitor-ai.vip -d www.monitor-ai.vip --non-interactive --agree-tos --email admin@monitor-ai.vip
echo "SSL certificate obtained OK"
"@

# ============================================================
# PHASE 6: PM2 setup + start
# ============================================================
Write-Host "`n[Phase 6/6] Starting application with PM2..." -ForegroundColor Yellow
Invoke-SSH @"
npm install -g pm2
cd $REMOTE_DIR
PORT=3000 pm2 start server.js --name monitor-ai
pm2 save
pm2 startup systemd -u root --hp /root
echo "PM2 started OK"
"@

# ============================================================
# Verification
# ============================================================
Write-Host "`n========================================" -ForegroundColor Green
Write-Host " Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nVerifying..." -ForegroundColor Yellow
Invoke-SSH "pm2 status && curl -sI http://localhost:3000 | head -5"

Write-Host "`nVisit: https://monitor-ai.vip" -ForegroundColor Cyan
