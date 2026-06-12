# npm이 PATH에 없을 때 복구 시도 (Windows)
$ErrorActionPreference = "Stop"

$nodeDir = "C:\Program Files\nodejs"
$npmCmd = Join-Path $nodeDir "npm.cmd"

Write-Host "=== npm 진단 ===" -ForegroundColor Cyan

if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "[OK] node: $(node -v) @ $((Get-Command node).Source)"
} else {
    Write-Host "[X] node 없음"
}

if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "[OK] npm: $(npm -v) @ $((Get-Command npm).Source)"
} elseif (Test-Path $npmCmd) {
    Write-Host "[!] npm.cmd는 있지만 PATH에 없음: $npmCmd" -ForegroundColor Yellow
    Write-Host "    버전: $(& $npmCmd -v)"
    Write-Host ""
    Write-Host "임시 사용:" -ForegroundColor Green
    Write-Host '  & "C:\Program Files\nodejs\npm.cmd" install'
    Write-Host '  & "C:\Program Files\nodejs\npm.cmd" -v'
    Write-Host ""
    Write-Host "영구 수정: Windows 설정 > 시스템 > 정보 > 고급 시스템 설정 > 환경 변수"
    Write-Host "  Path에 추가: C:\Program Files\nodejs"
} else {
    Write-Host "[X] npm.cmd 없음 — Node.js 재설치 필요" -ForegroundColor Red
    Write-Host "  https://nodejs.org/ko/download"
}
