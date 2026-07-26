# Step 1: Build project locally
$ErrorActionPreference = "Stop"
Set-Location D:\monitor-ai

Write-Host "[1/3] Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "[2/3] Building project..." -ForegroundColor Yellow
npm run build

Write-Host "[3/3] Build complete!" -ForegroundColor Green
Write-Host "Output: .next/standalone/" -ForegroundColor Cyan
