# monitor-ai Auto Deploy Script
# Run: powershell -ExecutionPolicy Bypass .\deploy\deploy.ps1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$SERVER_IP = $env:MONITOR_AI_SERVER_IP
if (-not $SERVER_IP) { $SERVER_IP = Read-Host "请输入服务器 IP" }
$SERVER = "root@$SERVER_IP"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  monitor-ai Deploy Tool" -ForegroundColor Cyan
Write-Host "  monitor-ai.vip -> $SERVER_IP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location D:\monitor-ai

# Step 1: Package
Write-Host "[1/3] Packaging build output..." -ForegroundColor Yellow
if (-not (Test-Path ".next\standalone\server.js")) {
    Write-Host "ERROR: Run 'npm run build' first" -ForegroundColor Red
    exit 1
}
if (Test-Path "public") {
    Copy-Item -Path "public\*" -Destination ".next\standalone\" -Recurse -Force
}
tar -czf deploy/monitor-ai.tar.gz -C .next\standalone .
Write-Host "  OK - deploy/monitor-ai.tar.gz" -ForegroundColor Green

# Step 2: Upload
Write-Host "[2/3] Uploading to server (enter password when prompted)..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no deploy/monitor-ai.tar.gz deploy/remote-setup.sh deploy/nginx-monitor-ai.conf ${SERVER}:/root/

# Step 3: Remote setup
Write-Host "[3/3] Installing & configuring on server (enter password again)..." -ForegroundColor Yellow
Write-Host "  This will: install Node.js/Nginx/SSL, extract app, start PM2" -ForegroundColor DarkGray
ssh ${SERVER} -o StrictHostKeyChecking=no "bash /root/remote-setup.sh && cd /opt && rm -rf monitor-ai && tar -xzf /root/monitor-ai.tar.gz -C monitor-ai && cd /opt/monitor-ai && npm install --production && cp /root/nginx-monitor-ai.conf /etc/nginx/sites-available/monitor-ai && ln -sf /etc/nginx/sites-available/monitor-ai /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx && certbot --nginx -d monitor-ai.vip -d www.monitor-ai.vip --non-interactive --agree-tos --email admin@monitor-ai.vip || echo 'SSL skipped' && npm install -g pm2 && PORT=3000 pm2 start /opt/monitor-ai/server.js --name monitor-ai -f && pm2 save && pm2 startup systemd -u root --hp /root 2>/dev/null || true && echo '' && echo '=== DEPLOY COMPLETE ===' && echo 'Visit: https://monitor-ai.vip'"

Remove-Item deploy/monitor-ai.tar.gz -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Script finished!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Remaining: Add DNS A records in Aliyun console:" -ForegroundColor Yellow
Write-Host "  monitor-ai.vip -> $SERVER_IP" -ForegroundColor White
Write-Host "  www.monitor-ai.vip -> $SERVER_IP" -ForegroundColor White
