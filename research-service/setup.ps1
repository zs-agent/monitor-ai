# 一次性安装：克隆上游 gpt-researcher（固定 commit）→ 建 venv → 装依赖。
# 幂等：重复运行只做校验；pinned-commit.txt 记录当前锁定的上游版本。
param(
  [string]$Ref = "",                                        # 指定上游 commit/分支；留空则用 pinned-commit.txt
  [string]$Index = "https://pypi.tuna.tsinghua.edu.cn/simple"  # 国内镜像
)
$ErrorActionPreference = "Stop"

$here   = Split-Path -Parent $MyInvocation.MyCommand.Path
$vendor = Join-Path $here "gpt-researcher"
$pin    = Join-Path $here "pinned-commit.txt"
$venv   = Join-Path $here ".venv"
$python = Join-Path $venv "Scripts/python.exe"

if (-not (Test-Path $vendor)) {
  Write-Host "clone upstream -> $vendor"
  git clone --branch main --depth 100 https://github.com/assafelovic/gpt-researcher.git $vendor
}

if (-not $Ref -and (Test-Path $pin)) { $Ref = (Get-Content $pin -Raw).Trim() }
if ($Ref) {
  git -C $vendor fetch --depth 100 origin $Ref
  git -C $vendor checkout --force $Ref
}
$sha = (git -C $vendor rev-parse HEAD).Trim()
Set-Content -Path $pin -Value $sha -NoNewline
Write-Host "upstream pinned at $sha"

if (-not (Test-Path $venv)) { uv venv $venv --python 3.12 }

uv pip install --python $python --index-url $Index `
  -e $vendor `
  -r (Join-Path $vendor "backend/requirements.txt") `
  -r (Join-Path $here "requirements.txt")

if (-not (Test-Path (Join-Path $here ".env"))) {
  Copy-Item (Join-Path $here ".env.example") (Join-Path $here ".env")
  Write-Host "created .env from template — 记得填 DEEPSEEK_API_KEY"
}

Write-Host "`n完成。下一步：填 .env → .venv/Scripts/python.exe run_task.py --focus `"...`""
