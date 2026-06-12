# 솔루션 문서 Q&A — 초기 설정 스크립트
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}

Refresh-Path

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js가 설치되어 있지 않습니다. winget으로 설치를 시도합니다..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --disable-interactivity
    Refresh-Path
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js 설치 후 터미널을 새로 열고 다시 실행해 주세요." -ForegroundColor Red
    Write-Host "수동 설치: https://nodejs.org/ko/download" -ForegroundColor Yellow
    exit 1
}

Write-Host "Node.js $(node -v) / npm $(npm -v)" -ForegroundColor Green
npm install

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host ".env 파일을 생성했습니다. GEMINI_API_KEY를 입력해 주세요." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "설정 완료. 다음 단계:" -ForegroundColor Green
Write-Host "  1. data/docs/ 에 메뉴얼 파일 복사"
Write-Host "  2. .env 에 GEMINI_API_KEY 설정"
Write-Host "  3. npm run index-docs        (임베딩 포함, 권장)"
Write-Host "  4. npx vercel dev            (로컬 실행)"
