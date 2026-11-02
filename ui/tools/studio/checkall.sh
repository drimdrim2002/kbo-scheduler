#!/bin/bash
cd "$(dirname "$0")"
# routes.txt: 이름|주소[|?뒤에 붙일 값]. 예전 화면 줄은 classic=1(새 흐름이 2025를 비교 화면으로 돌려보내므로)
# JOBS=4(기본): Chrome을 4개씩 동시에 띄운다. 출력 순서는 routes.txt 순서 그대로
# ONLY=pf-: 이름이 그것으로 시작하는 줄만 본다(pf- = 지금 흐름). 예: ONLY=pf- bash checkall.sh
JOBS=${JOBS:-4}
TMP=$(mktemp -d /private/tmp/claude-501/checkall.XXXXXX)
n=0
while IFS='|' read -r name hash query; do
  [ -n "$ONLY" ] && [ "${name#"$ONLY"}" = "$name" ] && continue
  for s in "1440 877" "1920 1057"; do
    set -- $s; n=$((n + 1))
    (r=$(./check.sh $1 $2 "$hash" "$name" "$query"); echo "$name $1: $r" > "$TMP/$(printf %05d $n)") &
    while [ "$(jobs -rp | wc -l)" -ge "$JOBS" ]; do sleep 0.2; done
  done
done < "${1:-routes.txt}"
wait
cat "$TMP"/* 2>/dev/null
rm -rf "$TMP"
