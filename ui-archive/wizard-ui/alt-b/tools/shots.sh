#!/bin/bash
# 헤드리스 Chrome으로 화면 캡처와 스크롤 점검을 한다.
#   tools/shots.sh shot <name> <hash> [W H]   → shots/<name>-<W>.png
#   tools/shots.sh check <hash> [W H]         → data-scroll JSON 출력

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=/private/tmp/claude-501/wizard-alt-b
mode="$1"; shift
if [ "$mode" = shot ]; then name="$1"; hash="$2"; W="${3:-1440}"; H="${4:-790}"; else hash="$1"; W="${2:-1440}"; H="${3:-790}"; fi
WH=$((H+87))  # headless=new 창 높이에서 뷰포트가 87px 작다
prof="$TMP/chrome-$$-$RANDOM"
rm -rf "$prof"; mkdir -p "$prof"
url="file://$ROOT/index.html?debug=scroll&fresh=1$hash"
shoturl="file://$ROOT/index.html?fresh=1$hash"
if [ "$mode" = shot ]; then
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$prof" --window-size=$W,$H --virtual-time-budget=4000 --screenshot="$ROOT/shots/$name-$W.png" "$shoturl" >/dev/null 2>&1
  echo "shots/$name-$W.png"
else
  for try in 1 2 3 4; do
    dom=$("$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$prof" --window-size=$W,$WH --virtual-time-budget=4000 --dump-dom "$url" 2>/dev/null)
    r=$(echo "$dom" | grep -o 'data-scroll="[^"]*"' | head -1 | sed 's/&quot;/"/g')
    if [ -n "$r" ]; then echo "$r $(echo "$dom" | grep -o 'data-errors="[^"]*"' | head -1)"; break; fi
  done
fi
rm -rf "$prof"
