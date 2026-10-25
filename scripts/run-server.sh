#!/usr/bin/env bash
# KBO 일정 편성 서버를 빌드하고 띄운다. 인자는 그대로 BaseballWebServer로 넘어간다.
#   scripts/run-server.sh --port 8080 --ui ui --max-seconds 30 --seeds 4
set -euo pipefail
cd "$(dirname "$0")/.."
# 카카오 REST 키(도로거리 자동 계산): 환경 변수가 없으면 .env 의 KAKAO_REST_KEY 줄만 읽는다(.env 를 실행하지 않음)
if [ -z "${KAKAO_REST_KEY:-}" ] && [ -f .env ]; then
  KAKAO_REST_KEY="$(sed -n 's/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}KAKAO_REST_KEY[[:space:]]*=[[:space:]]*//p' .env | tail -n 1 | tr -d '"'"'"' \r')"
  [ -n "$KAKAO_REST_KEY" ] && export KAKAO_REST_KEY
fi
bash scripts/ui-config.sh >/dev/null || true
mvn -q compile -DskipTests
mvn -q dependency:build-classpath -Dmdep.outputFile=target/cp.txt
exec java -Xmx4g -Dlogback.level.org.optaplanner=warn \
  -cp "target/classes:$(cat target/cp.txt)" \
  org.optaplanner.examples.baseball.web.BaseballWebServer "$@"
