#!/bin/bash
# usage: shot.sh [name] [W H] ["query"] -> $OUT(기본 shots)/admin-<name>-<W>.png (file://이면 예시 기록)
N=${1:-list}; W=${2:-1440}; H=${3:-900}; Q=${4:-""}
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT=${OUT:-$ROOT/shots}; mkdir -p "$OUT"
PROF=/private/tmp/claude-501/wizard-final/chrome-admin-shot-$W-$$
rm -rf "$PROF"
"$CH" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROF" --window-size=$W,$H --virtual-time-budget=4000 --screenshot="$OUT/admin-$N-$W.png" "file://$ROOT/admin/index.html?$Q" >/dev/null 2>&1
rm -rf "$PROF"
echo "$OUT/admin-$N-$W.png"
