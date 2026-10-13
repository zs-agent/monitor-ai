# monitor-ai.vip 部署指南

## 前置条件

| 项目 | 值 |
|------|-----|
| 域名 | monitor-ai.vip |
| 服务器 IP | <SERVER_IP> |
| 操作系统 | Ubuntu 22.04+ |
| 部署方式 | Next.js Standalone + Nginx + PM2 |

---

## 第 1 步：服务器初始化

SSH 登录服务器，运行初始化脚本：

```bash
ssh root@<SERVER_IP>
# 输入密码（见本地机密备忘文件，本指南不记录明文）

# 上传部署文件夹
# （在本地执行）
cd D:\monitor-ai
scp -r deploy\* root@<SERVER_IP>:/opt/
```

然后在服务器上执行：

```bash
chmod +x /opt/setup-server.sh
bash /opt/setup-server.sh
```

---

## 第 2 步：本地构建

在本地（Windows 开发机）执行：

```powershell
cd D:\monitor-ai

# 安装依赖
npm install

# 构建（生成 .next/standalone/）
npm run build
```

---

## 第 3 步：上传构建产物

```powershell
# 上传 standalone 服务器
rsync -avz --delete .next/standalone/ root@<SERVER_IP>:/opt/monitor-ai/

# 上传 public 资源
rsync -avz --delete public/ root@<SERVER_IP>:/opt/monitor-ai/public/

# 上传静态文件
rsync -avz .next/static/ root@<SERVER_IP>:/opt/monitor-ai/.next/static/

# 上传部署配置
scp deploy/nginx-monitor-ai.conf root@<SERVER_IP>:/opt/monitor-ai/
```

---

## 第 4 步：服务器上配置并启动

SSH 登录服务器：

```bash
ssh root@<SERVER_IP>
```

### 4.1 安装生产依赖

```bash
cd /opt/monitor-ai
cp /root/.next/standalone/node_modules/.package-lock.json ./ 2>/dev/null || true
npm install --production
```

### 4.2 测试运行

```bash
# 前台测试（Ctrl+C 停止）
PORT=3000 node server.js
```

访问 `http://<SERVER_IP>:3000` 验证服务正常。

### 4.3 配置 Nginx

```bash
# 复制 Nginx 配置
cp deploy/nginx-monitor-ai.conf /etc/nginx/sites-available/monitor-ai

# 启用站点
ln -sf /etc/nginx/sites-available/monitor-ai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 验证配置
nginx -t

# 重载 Nginx
systemctl reload nginx
```

### 4.4 配置 SSL (Let's Encrypt)

```bash
# 确保 80/443 端口已开放（阿里云安全组）
certbot --nginx -d monitor-ai.vip -d www.monitor-ai.vip

# 按照提示输入邮箱，同意条款
# 证书会自动续期
```

### 4.5 安装 PM2 并设置开机自启

```bash
# 全局安装 PM2
npm install -g pm2

# 启动应用
cd /opt/monitor-ai
PORT=3000 pm2 start server.js --name monitor-ai

# 保存进程列表
pm2 save

# 生成开机自启脚本
pm2 startup systemd
# 按提示执行输出的命令

# 查看状态
pm2 status
pm2 logs monitor-ai --lines 20
```

---

### 4.6 研究服务（多智能体，可选）

`/research` 页面依赖 research-service（FastAPI + gpt-researcher）。它不跟 PM2 走，单独用 systemd 常驻：

```bash
# 1) 上传服务目录（本地执行；gpt-researcher/ 与 .venv/ 不入库，服务器上重装）
rsync -avz --exclude 'gpt-researcher' --exclude '.venv' --exclude 'outputs' --exclude 'runs' \
  research-service/ root@<SERVER_IP>:/opt/monitor-ai/research-service/

# 2) 服务器上装依赖（Python 3.12）
cd /opt/monitor-ai/research-service
git clone --depth 1 https://github.com/assafelovic/gpt-researcher.git gpt-researcher
python3.12 -m venv .venv
.venv/bin/pip install --index-url https://pypi.tuna.tsinghua.edu.cn/simple \
  -e gpt-researcher -r gpt-researcher/backend/requirements.txt -r requirements.txt
cp .env.example .env      # 填 DEEPSEEK_API_KEY（检索器默认 openalex，免 key）

# 3) 常驻
cp /opt/monitor-ai/deploy/monitor-ai-research.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now monitor-ai-research
curl -s http://127.0.0.1:8000/health     # 期望 llm_key_present: true
```

Nginx 侧已在 `deploy/nginx-monitor-ai.conf` 里为 `/api/research/` 单独配了 SSE 反代（关缓冲 + 3600s 读超时），改完执行 `nginx -t && systemctl reload nginx`。
研究服务没起也不影响站点其余部分：`/research` 页面会显示"服务不可达 + 启动命令"，其他页面照常。

---

## 第 5 步：配置 DNS

在阿里云 DNS 控制台添加以下 A 记录：

| 记录类型 | 主机记录 | 记录值 |
|---------|---------|--------|
| A | @ | <SERVER_IP> |
| A | www | <SERVER_IP> |

TTL 建议设置为 600（10 分钟），等待 DNS 生效（一般 1-10 分钟）。

---

## 第 6 步：验证

```bash
# 本地网络测试
curl -I https://monitor-ai.vip

# 预期返回 200 OK
```

浏览器打开 `https://monitor-ai.vip` 验证。

---

## 常用运维命令

```bash
# 查看应用状态
pm2 status

# 查看实时日志
pm2 logs monitor-ai

# 重启应用
pm2 restart monitor-ai

# 更新代码后重新部署
# 1. 本地重新构建：npm run build
# 2. 重新上传 standalone 目录
# 3. 服务器上：pm2 restart monitor-ai

# 证书续期（自动，无需手动）
certbot renew --dry-run
```

## 阿里云安全组开放端口

在阿里云实例的安全组规则中，确保以下入方向规则已添加：

| 端口 | 协议 | 来源 | 说明 |
|------|------|------|------|
| 22 | TCP | 0.0.0.0/0 | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP |
| 443 | TCP | 0.0.0.0/0 | HTTPS |
| 3000 | TCP | 0.0.0.0/0 | 应用（可选，Nginx 代理后可关闭） |
