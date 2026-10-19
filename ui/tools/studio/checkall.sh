#!/bin/bash
cd "$(dirname "$0")"
while IFS='|' read -r name hash; do
  for s in "1440 877" "1920 1057"; do set -- $s; r=$(./check.sh $1 $2 "$hash" "$name"); echo "$name $1: $r"; done
done < "${1:-routes.txt}"
