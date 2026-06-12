#!/usr/bin/env bash
# Rocky Linux / Linux용 인덱싱 스크립트
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "[오류] node/npm 을 찾을 수 없습니다."
  echo ""
  echo "Rocky Linux 9.1 설치 예시:"
  echo "  sudo dnf install -y nodejs npm"
  echo "  # 또는 Node 20:"
  echo "  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -"
  echo "  sudo dnf install -y nodejs"
  echo ""
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "의존성 설치 중..."
  npm install
fi

echo "Node $(node -v) / npm $(npm -v)"
node scripts/index-docs.js "$@"
