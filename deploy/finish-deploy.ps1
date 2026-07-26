# monitor-ai - 继续部署（在已有 PowerShell 中运行）
$SERVER = "root@101.37.84.238"
$PASSWORD = "9neK2yU~r&st*&9"

Write-Host "Step 1: Upload files (enter password when prompted)..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no D:\monitor-ai\deploy\monitor-ai.tar.gz D:\monitor-ai\deploy\nginx-monitor-ai.conf ${SERVER}:/opt/

Write-Host "Step 2: SSH + continue setup (enter password again)..." -ForegroundColor Yellow
ssh ${SERVER} -o StrictHostKeyChecking=no @"

echo '=== 4/8 解压应用 ==='
rm -rf /opt/monitor-ai
mkdir -p /opt/monitor-ai
tar -xzf /opt/monitor-ai.tar.gz -C /opt/monitor-ai/
cd /opt/monitor-ai
echo '=== 安装依赖 ==='
npm install --production

echo '=== 5/8 配置 Nginx ==='
cp /opt/nginx-monitor-ai.conf /etc/nginx/sites-available/monitor-ai
ln -sf /etc/nginx/sites-available/monitor-ai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo '=== 6/8 SSL 证书 ==='
echo '跳过 SSL，请先配置 DNS 后运行: certbot --nginx -d monitor-ai.vip'

echo '=== 7/8 PM2 启动 ==='
npm install -g pm2
PORT=3000 pm2 start /opt/monitor-ai/server.js --name monitor-ai -f
pm2 save

echo '=== 8/8 验证 ==='
sleep 2
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000

echo ''
echo '=== 部署完成！==='
echo '访问: http://101.37.84.238:3000'
echo '配置 DNS 后访问: https://monitor-ai.vip'
"@
