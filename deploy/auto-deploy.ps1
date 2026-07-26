# monitor-ai 全自动部署脚本
# 在 PowerShell 中运行:
#   cd D:\monitor-ai
#   .\deploy\auto-deploy.ps1
# 只需要输入服务器密码 2 次

$SERVER = "root@101.37.84.238"
$PASSWORD = "9neK2yU~r&st*&9"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " monitor-ai 自动部署" -ForegroundColor Cyan
Write-Host " 域名: monitor-ai.vip → 101.37.84.238" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location D:\monitor-ai

# ──── Step 1: 压缩 ────
Write-Host "[1/3] 打包构建产物..." -ForegroundColor Yellow
if (-not (Test-Path ".next\standalone\server.js")) {
    Write-Host "ERROR: 请先运行 npm run build" -ForegroundColor Red
    exit 1
}
# 复制 public
if (Test-Path "public") { Copy-Item -Path "public\*" -Destination ".next\standalone\" -Recurse -Force }
# 打包
tar -czf deploy/monitor-ai.tar.gz -C .next\standalone .
Write-Host "      打包完成 (deploy/monitor-ai.tar.gz)" -ForegroundColor Green

# ──── Step 2: 上传（需要输入密码 1 次）────
Write-Host "[2/3] 上传到服务器（请输入密码）..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no deploy\monitor-ai.tar.gz deploy\remote-setup.sh deploy\nginx-monitor-ai.conf ${SERVER}:/root/

# ──── Step 3: SSH 执行部署（需要输入密码 1 次）────
Write-Host "[3/3] 在服务器上安装配置..." -ForegroundColor Yellow
ssh ${SERVER} -o StrictHostKeyChecking=no "
set -e
echo '=== 1/8 系统更新 ==='
apt-get update -qq && apt-get upgrade -y -qq
echo '=== 2/8 安装基础软件 ==='
apt-get install -y -qq curl wget git nginx certbot python3-certbot-nginx
echo '=== 3/8 安装 Node.js 20 ==='
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y -qq nodejs
echo 'Node.js: '$(node --version)
echo '=== 4/8 解压应用 ==='
rm -rf /opt/monitor-ai && mkdir -p /opt/monitor-ai
tar -xzf /root/monitor-ai.tar.gz -C /opt/monitor-ai
cd /opt/monitor-ai && npm install --production
echo '=== 5/8 配置 Nginx ==='
cp /root/nginx-monitor-ai.conf /etc/nginx/sites-available/monitor-ai
ln -sf /etc/nginx/sites-available/monitor-ai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo '=== 6/8 SSL 证书 ==='
certbot --nginx -d monitor-ai.vip -d www.monitor-ai.vip --non-interactive --agree-tos --email admin@monitor-ai.vip || echo 'SSL 暂跳过（DNS 可能未生效）'
echo '=== 7/8 PM2 启动 ==='
npm install -g pm2
PORT=3000 pm2 start /opt/monitor-ai/server.js --name monitor-ai -f
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true
echo '=== 8/8 验证 ==='
pm2 status
curl -s -o /dev/null -w 'HTTP Status: %{http_code}' http://localhost:3000
echo ''
echo '=== 部署完成 ==='
"

Write-Host "" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host " 部署流程执行完毕！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "下一步：在阿里云 DNS 控制台添加 A 记录：" -ForegroundColor Yellow
Write-Host "  monitor-ai.vip → 101.37.84.238" -ForegroundColor White
Write-Host "  www.monitor-ai.vip → 101.37.84.238" -ForegroundColor White
Write-Host ""
Write-Host "浏览器访问: https://monitor-ai.vip" -ForegroundColor Cyan

Remove-Item deploy\monitor-ai.tar.gz -Force
