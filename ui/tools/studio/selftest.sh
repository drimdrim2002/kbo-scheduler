#!/bin/bash
# usage: selftest.sh [W H] -> prints data-selftest (?selftest=1) and data-errors
W=${1:-1440}; H=${2:-877}
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROF=/private/tmp/claude-501/wizard-final/chrome-selftest-$W-$$
rm -rf "$PROF"
"$CH" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROF" --window-size=$W,$H --virtual-time-budget=90000 --dump-dom "file://$ROOT/index.html?selftest=1#step=1&tab=slots" 2>/dev/null | grep -o 'data-selftest="[^"]*"\|data-errors="[^"]*"\|data-error-list="[^"]*"' | sed 's/ | /\n/g'
rm -rf "$PROF"
# 계획 흐름(?plantest=1): 빈 프로필에서 실제 버튼으로 검토·옵션·실행·버전을 확인한다
"$CH" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROF" --window-size=$W,$H --virtual-time-budget=90000 --dump-dom "file://$ROOT/index.html?plantest=1#step=1&pick=year" 2>/dev/null | grep -o 'data-plantest="[^"]*"\|data-errors="[^"]*"\|data-error-list="[^"]*"' | sed 's/ | /\n/g'
rm -rf "$PROF"
