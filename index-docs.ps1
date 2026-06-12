# npm 없이도 동작하는 인덱싱 스크립트 (Windows)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")

function Get-NpmCommand {
    $cmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $npmCmd = "C:\Program Files\nodejs\npm.cmd"
    if (Test-Path $npmCmd) { return $npmCmd }

    return $null
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "[오류] node 를 찾을 수 없습니다." -ForegroundColor Red
    Write-Host "  https://nodejs.org/ko/download 에서 LTS 설치 후 터미널을 새로 여세요."
    Write-Host ""
    exit 1
}

$npmPath = Get-NpmCommand

if (-not (Test-Path "node_modules")) {
    if (-not $npmPath) {
        Write-Host ""
        Write-Host "[오류] node_modules 가 없고 npm 도 찾을 수 없습니다." -ForegroundColor Red
        Write-Host ""
        Write-Host "해결 방법 (택1):" -ForegroundColor Yellow
        Write-Host '  1. "C:\Program Files\nodejs\npm.cmd" install'
        Write-Host "  2. Node.js LTS 재설치 (npm 포함)"
        Write-Host ""
        exit 1
    }
    Write-Host "의존성 설치 중..." -ForegroundColor Cyan
    & $npmPath install
}

$nodeVer = node -v
if ($npmPath) {
    $npmVer = & $npmPath -v
    Write-Host "Node $nodeVer / npm $npmVer" -ForegroundColor Green
} else {
    Write-Host "Node $nodeVer (npm 없음 — node로 직접 실행)" -ForegroundColor Yellow
}

node scripts/index-docs.js @args
