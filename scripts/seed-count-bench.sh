#!/usr/bin/env bash
# 동시에 찾는 갈래 수 4 vs 8 벤치(docs/ENGINE_8SEED_BENCHMARK.md). 한 조건씩 차례로 돈다(겹치지 않게).
#   bash scripts/seed-count-bench.sh <outDir> [초] [해]   (저장소 루트에서, 먼저 bash deploy/build.sh 또는 compile + target/lib)
#   [초]·[해]를 주면 그 조건만 돈다(예: 60 2028).
# 조건: 10초(보여주는 문: 개선 없음 종료 없음) 2025·2027, 60초(편성 스튜디오: 개선 없음 종료 = 시간의 절반) 2025·2027·2028.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${1:?outDir}
ONLY_SEC=${2:-}
ONLY_YEAR=${3:-}
mkdir -p "$OUT"
node scripts/seed-count-problems.js "$OUT"
JAVA=(java -Xmx6g -Dlogback.level.org.optaplanner=info -cp "target/classes:target/lib/*" org.optaplanner.examples.baseball.web.SeedCountBench)
# 입력 초 개선없음초 묶음수 시드기준 한번에8묶음수
CONDS=(
  "2025 10 0 10 1000000 5"
  "2027 10 0 10 2000000 5"
  "2025 60 30 10 3000000 3"
  "2027 60 30 10 4000000 0"
  "2028 60 30 10 7000000 0"
)
for c in "${CONDS[@]}"; do
  read -r year sec unimp groups base atonce <<< "$c"
  if [ -n "$ONLY_SEC" ] && [ "$sec" != "$ONLY_SEC" ]; then continue; fi
  if [ -n "$ONLY_YEAR" ] && [ "$year" != "$ONLY_YEAR" ]; then continue; fi
  echo "=== $(date '+%F %T') $year ${sec}s" | tee -a "$OUT/progress.txt"
  uptime >> "$OUT/progress.txt"
  "${JAVA[@]}" "$OUT/problem-$year.json" "$OUT" "$year" "$sec" "$unimp" "$groups" "$base" "$atonce" > "$OUT/log-$year-$sec.txt" 2>&1
done
echo "=== $(date '+%F %T') all done" | tee -a "$OUT/progress.txt"
