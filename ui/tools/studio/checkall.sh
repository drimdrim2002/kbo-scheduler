#!/bin/bash
cd "$(dirname "$0")"
# routes.txt: 이름|주소[|?뒤에 붙일 값]. 예전 화면 줄은 classic=1(새 흐름이 2025를 비교 화면으로 돌려보내므로)
while IFS='|' read -r name hash query; do
  for s in "1440 877" "1920 1057"; do set -- $s; r=$(./check.sh $1 $2 "$hash" "$name" "$query"); echo "$name $1: $r"; done
done < "${1:-routes.txt}"
