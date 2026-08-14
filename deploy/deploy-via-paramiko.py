# -*- coding: utf-8 -*-
"""monitor-ai 增量部署：本地打包 -> SFTP 上传 -> 服务器备份+解压 -> npm install -> PM2 重启 -> 验证"""
import os, sys, tarfile, io, paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
HOST = "101.37.84.238"
USER = "root"
with open(os.path.join(ROOT, "新建 文本文档.txt"), encoding="utf-8") as f:
    lines = [l for l in f.read().splitlines() if l.strip()]
PASSWORD = lines[2].split(": ", 1)[1].strip()
STAGE_DIR = os.path.join(BASE, "stage")
STANDALONE = os.path.join(ROOT, ".next", "standalone")

def main():
    # ---------- Step 1: 本地打包 standalone ----------
    print("[1/5] 打包 .next/standalone ...")
    if not os.path.exists(os.path.join(STANDALONE, "server.js")):
        print("ERROR: 缺少 server.js，请先 npm run build"); sys.exit(1)
    os.makedirs(STAGE_DIR, exist_ok=True)
    tarball = os.path.join(STAGE_DIR, "monitor-ai.tar.gz")
    with tarfile.open(tarball, "w:gz") as tar:
        for entry in os.listdir(STANDALONE):
            tar.add(os.path.join(STANDALONE, entry), arcname=entry, recursive=True)
    size_mb = os.path.getsize(tarball) / 1024 / 1024
    print(f"      打包完成: {size_mb:.1f} MB")

    # ---------- Step 2: SFTP 上传 ----------
    print("[2/5] 连接并上传到服务器 ...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=20)
    sftp = client.open_sftp()
    sftp.put(tarball, "/root/monitor-ai.tar.gz")
    sftp.close()
    print("      上传完成 -> /root/monitor-ai.tar.gz")

    # ---------- Step 3: 服务器备份 ----------
    print("[3/5] 备份当前部署 ...")
    cmd_backup = (
        "TS=$(date +%Y%m%d-%H%M%S) && "
        "if [ -d /opt/monitor-ai ] && [ -n \"$(ls -A /opt/monitor-ai 2>/dev/null)\" ]; then "
        "mv /opt/monitor-ai /opt/monitor-ai.bak.$TS && echo \"备份到 /opt/monitor-ai.bak.$TS\"; "
        "else echo '旧目录为空或不存在，跳过备份'; fi"
    )
    out, err = exec_cmd(client, cmd_backup)
    print(out.strip() or err.strip())

    # ---------- Step 4: 解压（standalone 自带完整 node_modules，无需 npm install）----------
    print("[4/5] 解压新代码 ...")
    cmd_deploy = (
        "set -e; "
        "mkdir -p /opt/monitor-ai && "
        "tar -xzf /root/monitor-ai.tar.gz -C /opt/monitor-ai && "
        "echo '--- files ---'; ls /opt/monitor-ai | head -20"
    )
    out, err = exec_cmd(client, cmd_deploy)
    print(out.strip() or err.strip())

    # ---------- Step 5: PM2 重启 + 验证 ----------
    print("[5/5] PM2 重启并验证 ...")
    cmd_start = (
        "cd /opt/monitor-ai && "
        "(pm2 describe monitor-ai >/dev/null 2>&1 && pm2 restart monitor-ai --update-env || "
        "PORT=3000 pm2 start server.js --name monitor-ai) && "
        "pm2 save && sleep 3 && "
        "echo '--- pm2 status ---' && pm2 list && "
        "echo '--- http check ---' && curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:3000 && echo"
    )
    out, err = exec_cmd(client, cmd_start)
    print(out.strip() or err.strip())

    client.close()
    print("\nDEPLOY DONE")

def exec_cmd(client, cmd, timeout=180):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    return out, err

if __name__ == "__main__":
    main()
