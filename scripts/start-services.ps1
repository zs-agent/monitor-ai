# 一键启动 monitor-ai 工作台所需的两个进程（Windows / PowerShell 5.1+）
#
# 用法（在仓库根目录执行）：
#   powershell -ExecutionPolicy Bypass -File scripts/start-services.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/start-services.ps1 -Port 3200 -ResearchPort 8100
#
# 注意：本文件必须以 UTF-8 **带 BOM** 保存。PowerShell 5.1 对无 BOM 的 UTF-8
# 会按 GBK 解码，中文注释里的字节会被误读成引号，导致"字符串缺少终止符"解析错误。
param(
  [int]$Port = 3100,          # 前端端口（3000 常被其他项目占用）
  [int]$ResearchPort = 8000   # 研究服务端口
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$research = Join-Path $root "research-service"
$py = Join-Path $research ".venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
  Write-Warning "未找到 research-service\.venv —— 请先执行 research-service\setup.ps1"
  exit 1
}
$envFile = Join-Path $research ".env"
if (-not (Test-Path $envFile)) {
  Write-Warning "未找到 research-service\.env —— 复制 .env.example 并填入 DEEPSEEK_API_KEY"
}

Write-Host "启动前端 (Next dev :$Port) ..."
Start-Process -FilePath "node" `
  -ArgumentList "--max-old-space-size=2048", "node_modules/next/dist/bin/next", "dev", "--port", "$Port" `
  -WorkingDirectory $root

Write-Host "启动研究服务 (uvicorn :$ResearchPort) ..."
Start-Process -FilePath $py `
  -ArgumentList "-m", "uvicorn", "service.app:app", "--host", "127.0.0.1", "--port", "$ResearchPort" `
  -WorkingDirectory $research

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "工作台    http://localhost:$Port/nexus"
Write-Host "研究服务  http://127.0.0.1:$ResearchPort/health"
Write-Host "首次启动 Next dev 需要编译十几秒，稍后再打开页面。"

