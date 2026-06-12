# PDF 메뉴얼을 data/docs 에 넣고 인덱싱한 뒤 GitHub에 반영합니다.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "1) PDF를 data\docs\ 폴더에 넣어 주세요." -ForegroundColor Cyan
Write-Host "2) 인덱싱 실행 중..." -ForegroundColor Cyan
& "$PSScriptRoot\index-docs.ps1" @args

Write-Host ""
Write-Host "3) GitHub 반영:" -ForegroundColor Cyan
Write-Host "   git add data/docs data/index.json"
Write-Host '   git commit -m "PDF 메뉴얼 인덱스 갱신"'
Write-Host "   git push origin main"
Write-Host ""
Write-Host "Vercel 재배포 후 웹에서 PDF 내용으로 질문할 수 있습니다." -ForegroundColor Green
