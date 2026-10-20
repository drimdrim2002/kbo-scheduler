#!/bin/bash
# usage: shot.sh name "query" [W H] -> shots/replay-name-W.png (기본 1440×900, 모바일은 375 812)
NAME=$1; Q=${2:-"t=12"}; W=${3:-1440}; H=${4:-900}
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$ROOT/shots"
PROF=/private/tmp/claude-501/wizard-final/chrome-replay-shot-$NAME-$W
rm -rf "$PROF"
"$CH" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROF" --window-size=$W,$H --virtual-time-budget=4000 --screenshot="$ROOT/shots/replay-$NAME-$W.png" "file://$ROOT/replay.html?$Q" >/dev/null 2>&1
rm -rf "$PROF"
