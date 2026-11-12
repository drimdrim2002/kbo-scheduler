#!/bin/bash
# usage: check.sh [W H] ["query"] -> admin/index.html(편성 기록, file://이면 예시 기록)의 data-errors · data-scroll · data-admin
# 기대: data-errors="0" data-scroll="none" data-admin="list"(query가 signin=1이면 "signin")
W=${1:-1440}; H=${2:-900}; Q=${3:-""}
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROF=/private/tmp/claude-501/wizard-final/chrome-admin-chk-$W-$$
rm -rf "$PROF"
"$CH" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROF" --window-size=$W,$H --virtual-time-budget=4000 --dump-dom "file://$ROOT/admin/index.html?$Q" 2>/dev/null | grep -o 'data-scroll="[^"]*"\|data-errors="[^"]*"\|data-error-list="[^"]*"\|data-admin="[^"]*"' | sort -u | tr '\n' ' '
echo
rm -rf "$PROF"
