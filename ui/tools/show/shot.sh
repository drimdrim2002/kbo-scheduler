#!/bin/bash
# usage: shot.sh [page ...] [--hash "#replay"]  -> shots/show-<page>-<W>.png (375×812 · 768×1024 · 1440×900, 9장)
# 375는 헤드리스 창 최소 폭(500) 때문에 frame.html의 iframe으로 그리고 그림만 375 폭으로 남긴다.
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
mkdir -p "$ROOT/shots"
HASH=""; PAGES=""
while [ $# -gt 0 ]; do case $1 in --hash) HASH=$2; shift 2 ;; *) PAGES="$PAGES $1"; shift ;; esac; done
PAGES=${PAGES:-"index compare r"}
for P in $PAGES; do
  case $P in
    index) SRC="../../show/index.html?replay=now$HASH" ;;
    compare) SRC="../../show/compare.html$HASH" ;;
    r) SRC="../../show/r.html?id=default$HASH" ;;
    *) SRC="../../show/$P$HASH" ;;
  esac
  for W in 375 768 1440; do
    case $W in 375) H=812 ;; 768) H=1024 ;; *) H=900 ;; esac
    PROF=/private/tmp/claude-501/wizard-final/chrome-show-shot-$P-$W
    rm -rf "$PROF"
    ENC=$(printf '%s' "$SRC" | sed 's/?/%3F/g; s/&/%26/g; s/=/%3D/g; s/#/%23/g')
    "$CH" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROF" --window-size=$W,$H --virtual-time-budget=8000 --screenshot="$ROOT/shots/show-$P-$W.png" "file://$HERE/frame.html?w=$W&h=$H&src=$ENC" >/dev/null 2>&1
    rm -rf "$PROF"
    echo "shots/show-$P-$W.png"
  done
done
