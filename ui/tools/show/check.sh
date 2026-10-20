#!/bin/bash
# usage: check.sh [page ...]  -> 보여주는 문 3쪽 × 375·768·1440에서 data-scroll(가로 스크롤)·data-errors(콘솔 오류)·data-show(데이터)·data-replay(재생기)
# 헤드리스 Chrome은 --dump-dom에서 500px 밑 창 폭을 못 만들어 frame.html의 iframe 안에서 연다(replay=now: 재생기를 바로 로드).
# 종료 코드: 모든 조합이 SCROLL 없음·오류 0·데이터 ok·재생기 ready면 0.
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PAGES=${*:-"index compare r"}
FAIL=0
for P in $PAGES; do
  case $P in
    index) SRC="../../show/index.html?replay=now" ;;
    compare) SRC="../../show/compare.html" ;;
    r) SRC="../../show/r.html?id=default" ;;
    *) SRC="../../show/$P" ;;
  esac
  for W in 375 768 1440; do
    case $W in 375) H=812 ;; 768) H=1024 ;; *) H=900 ;; esac
    PROF=/private/tmp/claude-501/wizard-final/chrome-show-chk-$P-$W
    rm -rf "$PROF"
    ENC=$(printf '%s' "$SRC" | sed 's/?/%3F/g; s/&/%26/g; s/=/%3D/g')
    OUT=$("$CH" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROF" --window-size=$W,$H --virtual-time-budget=8000 --dump-dom "file://$HERE/frame.html?w=$W&h=$H&src=$ENC" 2>/dev/null | grep -o 'data-scroll="[^"]*"\|data-errors="[^"]*"\|data-error-list="[^"]*"\|data-replay="[^"]*"\|data-show="[^"]*"\|data-frame="[^"]*"' | tr '\n' ' ')
    rm -rf "$PROF"
    OK=1
    echo "$OUT" | grep -q 'data-scroll="OK' || OK=0
    echo "$OUT" | grep -q 'data-errors="0"' || OK=0
    echo "$OUT" | grep -q 'data-show="[a-z]*-ok"' || OK=0
    if [ "$P" != compare ]; then echo "$OUT" | grep -q 'data-replay="ready' || OK=0; fi
    [ $OK = 1 ] && TAG=PASS || { TAG=FAIL; FAIL=1; }
    echo "[$TAG] $P $W  $OUT"
  done
done
exit $FAIL
