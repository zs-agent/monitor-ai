#!/usr/bin/env bash
# ============================================================
# monitor-ai 服务器部署脚本
# 服务器: Ubuntu 22.04 / 24.04
# 域名: monitor-ai.vip
# ============================================================
set -euo pipefail

echo "========================================"
echo " monitor-ai 部署脚本"
echo " 目标: monitor-ai.vip → <SERVER_IP>"
echo "========================================"

# ─── 1. 系统更新 + 安装依赖 ──────────────────────────
echo "[1/8] 更新系统并安装基础软件包..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget git nginx certbot python3-certbot-nginx

# ─── 2. 安装 Node.js 20 LTS ──────────────────────────
echo "[2/8] 安装 Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
echo "Node.js: $(node --version)"
echo "npm:     $(npm --version)"

# ─── 3. 创建应用用户（安全） ──────────────────────────
echo "[3/8] 创建应用用户..."
id -u monitorai &>/dev/null || useradd -m -s /bin/bash monitorai

# ─── 4. 创建应用目录 ──────────────────────────────
echo "[4/8] 创建应用目录..."
mkdir -p /opt/monitor-ai
chown monitorai:monitorai /opt/monitor-ai

# ============================================================
# 以下步骤需要手动上传构建产物，详见 deploy-guide.md
# ============================================================

echo ""
echo "========================================"
echo " 服务器初始化完成！"
echo "========================================"
echo ""
echo "下一步操作（在本地开发机执行）："
echo ""
echo "  # 1. 在本地构建项目"
echo "  cd D:\\monitor-ai"
echo "  npm install"
echo "  npm run build"
echo ""
echo "  # 2. 将构建产物上传到服务器"
echo "  rsync -avz --delete .next/standalone/ root@<SERVER_IP>:/opt/monitor-ai/"
echo "  rsync -avz --delete public/ root@<SERVER_IP>:/opt/monitor-ai/public/"
echo "  rsync -avz .next/static/ root@<SERVER_IP>:/opt/monitor-ai/.next/static/"
echo ""
echo "  # 3. SSH 登录后继续配置..."
echo "  ssh root@<SERVER_IP>"
echo "  cd /opt/monitor-ai"
echo ""
echo "  # 4. 安装生产依赖"
echo "  npm install --production"
echo ""
echo "  # 5. 测试运行"
echo "  PORT=3000 node server.js &"
echo ""
echo "  # 6. 配置 Nginx + SSL"
echo "  cp /opt/monitor-ai/deploy/nginx-monitor-ai.conf /etc/nginx/sites-available/monitor-ai"
echo "  ln -sf /etc/nginx/sites-available/monitor-ai /etc/nginx/sites-enabled/"
echo "  rm -f /etc/nginx/sites-enabled/default"
echo "  nginx -t && systemctl reload nginx"
echo "  certbot --nginx -d monitor-ai.vip -d www.monitor-ai.vip"
echo ""
echo "  # 7. 安装 PM2 并启动"
echo "  npm install -g pm2"
echo "  PORT=3000 pm2 start server.js --name monitor-ai"
echo "  pm2 save"
echo "  pm2 startup systemd"
echo ""
echo "  # 8. 配置 DNS"
echo "  在阿里云 DNS 控制台添加 A 记录:"
echo "    monitor-ai.vip → <SERVER_IP>"
echo "    www.monitor-ai.vip → <SERVER_IP>"
echo ""
echo "========================================"
