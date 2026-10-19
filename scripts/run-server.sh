#!/usr/bin/env bash
# KBO 일정 편성 서버를 빌드하고 띄운다. 인자는 그대로 BaseballWebServer로 넘어간다.
#   scripts/run-server.sh --port 8080 --ui ui --max-seconds 30 --seeds 4
set -euo pipefail
cd "$(dirname "$0")/.."
mvn -q compile -DskipTests
mvn -q dependency:build-classpath -Dmdep.outputFile=target/cp.txt
exec java -Xmx4g -Dlogback.level.org.optaplanner=warn \
  -cp "target/classes:$(cat target/cp.txt)" \
  org.optaplanner.examples.baseball.web.BaseballWebServer "$@"
