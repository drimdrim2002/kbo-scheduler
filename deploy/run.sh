#!/usr/bin/env bash
# 빌드된 서버를 띄운다(systemd ExecStart 와 같은 명령). 환경 변수로 조정:
#   PORT(8080) DATA_DIR(data/results) MAX_SECONDS(30) SEEDS(코어 수, 최대 8) JAVA_XMX(6g)
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8080}"
DATA_DIR="${DATA_DIR:-data/results}"
MAX_SECONDS="${MAX_SECONDS:-30}"
SEEDS="${SEEDS:-$(( $(nproc 2>/dev/null || sysctl -n hw.ncpu) < 8 ? $(nproc 2>/dev/null || sysctl -n hw.ncpu) : 8 ))}"
JAVA_XMX="${JAVA_XMX:-6g}"
exec java -Xmx"$JAVA_XMX" -XX:+UseZGC -Djava.awt.headless=true -Dlogback.level.org.optaplanner=warn \
  -cp "target/classes:target/lib/*" \
  org.optaplanner.examples.baseball.web.BaseballWebServer \
  --port "$PORT" --ui ui --data "$DATA_DIR" --max-seconds "$MAX_SECONDS" --seeds "$SEEDS"
