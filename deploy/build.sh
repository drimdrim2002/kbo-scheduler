#!/usr/bin/env bash
# 서버 빌드: 컴파일 + 의존성 jar를 target/lib 에 모은다. 실행은 run.sh 또는 systemd 유닛이 한다.
#   deploy/build.sh            (저장소 루트에서)
set -euo pipefail
cd "$(dirname "$0")/.."
mvn -q -DskipTests compile
mvn -q dependency:copy-dependencies -DoutputDirectory=target/lib -DincludeScope=runtime
bash scripts/ui-config.sh   # 카카오 지도 키(/etc/kbo-scheduler/env) → ui/config.local.json
echo "build ok: target/classes + $(ls target/lib | wc -l | tr -d ' ') jars"
