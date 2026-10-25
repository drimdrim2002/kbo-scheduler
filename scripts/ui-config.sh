#!/usr/bin/env bash
# 화면용 설정 파일 ui/config.local.json 을 만든다(커밋하지 않는다, .gitignore).
# 카카오 지도 JavaScript 키를 아래 순서로 찾는다:
#   1) 환경 변수 KAKAO_JS_KEY
#   2) KBO_ENV_FILE 로 준 파일, 없으면 서버의 /etc/kbo-scheduler/env
#   3) 저장소 맨 위 .env
# 키가 없으면 ui/config.local.json 을 지운다(화면은 기본 지도). deploy/build.sh 가 배포 때마다 부른다.
#   bash scripts/ui-config.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=ui/config.local.json
# .env.example 은 커밋되는 파일 — 키가 들어 있으면 막는다(키는 .env 에)
if grep -q '^[[:space:]]*KAKAO_JS_KEY[[:space:]]*=[[:space:]]*[A-Za-z0-9]' .env.example 2>/dev/null; then
  echo "ui-config: .env.example 에 키 값이 있습니다. 이 파일은 커밋됩니다 — 키는 .env 로 옮기고 .env.example 은 'KAKAO_JS_KEY=' 로 비워 두세요." >&2
  exit 1
fi
read_key() { [ -f "$1" ] && sed -n 's/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}KAKAO_JS_KEY[[:space:]]*=[[:space:]]*//p' "$1" | tail -n 1 | tr -d '"'"'"' \r' || true; }
KEY="${KAKAO_JS_KEY:-}"
[ -z "$KEY" ] && KEY="$(read_key "${KBO_ENV_FILE:-/etc/kbo-scheduler/env}")"
[ -z "$KEY" ] && KEY="$(read_key .env)"
if [ -z "$KEY" ]; then
  rm -f "$OUT"
  echo "ui-config: KAKAO_JS_KEY 없음 → 기본 지도($OUT 지움)"
  exit 0
fi
if ! [[ "$KEY" =~ ^[A-Za-z0-9]+$ ]]; then
  echo "ui-config: KAKAO_JS_KEY 는 영문·숫자만 됩니다(카카오 JavaScript 키 32자)" >&2
  exit 1
fi
printf '{ "kakaoKey": "%s" }\n' "$KEY" > "$OUT"
echo "ui-config: $OUT 작성(카카오 키 ${#KEY}자 — 키 값은 출력하지 않음)"
