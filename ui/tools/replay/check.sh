#!/bin/bash
# usage: check.sh [W H] ["query"] -> replay.html의 data-scroll · data-errors · data-replay (file://에서 샘플 JSON을 읽기 위해 --allow-file-access-from-files)
W=${1:-1440}; H=${2:-900}; Q=${3:-"t=12"}
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROF=/private/tmp/claude-501/wizard-final/chrome-replay-chk-$W
rm -rf "$PROF"
"$CH" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROF" --window-size=$W,$H --virtual-time-budget=4000 --dump-dom "file://$ROOT/replay.html?$Q" 2>/dev/null | grep -o 'data-scroll="[^"]*"\|data-errors="[^"]*"\|data-error-list="[^"]*"\|data-replay="[^"]*"\|class="rp-cap"[^<]*<b>[^<]*</b>[^<]*' | tr '\n' ' '
echo
rm -rf "$PROF"
