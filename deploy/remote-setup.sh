#!/usr/bin/env bash
set -euo pipefail

echo "=== monitor-ai 服务器初始化 ==="

# 1. 系统更新
apt-get update -qq
apt-get upgrade -y -qq

# 2. 安装依赖
apt-get install -y -qq curl wget git nginx certbot python3-certbot-nginx sshpass

# 3. 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs

echo "Node.js: $(node --version)"
echo "npm:     $(npm --version)"

# 4. 创建目录
mkdir -p /opt/monitor-ai/.next/static /opt/monitor-ai/public
chmod -R 755 /opt/monitor-ai

# 5. 配置 Nginx
cat > /etc/nginx/sites-available/monitor-ai << 'NGINX'
server {
    listen 80;
    server_name monitor-ai.vip www.monitor-ai.vip;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name monitor-ai.vip www.monitor-ai.vip;
    ssl_certificate /etc/letsencrypt/live/monitor-ai.vip/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitor-ai.vip/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
    location /_next/static {
        alias /opt/monitor-ai/.next/static;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
    location /public {
        alias /opt/monitor-ai/public;
        expires 30d;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/monitor-ai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 6. SSL 证书
certbot --nginx -d monitor-ai.vip -d www.monitor-ai.vip --non-interactive --agree-tos --email admin@monitor-ai.vip || echo "SSL 证书申请跳过（可能 DNS 未生效）"

# 7. 安装 PM2
npm install -g pm2

echo ""
echo "=== 服务器初始化完成 ==="
echo "下一步：将本地构建产物上传到 /opt/monitor-ai/"
