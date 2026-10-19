#!/bin/bash
# alt-d 스크린샷 + 스크롤 점검 (헤드리스 Chrome)
# 사용: tools/shoot.sh [화면이름 ...]   (없으면 전체)
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="/private/tmp/claude-501/wizard-alt-d"
mkdir -p "$TMP" "$ROOT/shots"
SCREENS=(
  "P1-P2-data|step=1&tab=slots"
  "P2-season|step=1&tab=season"
  "P2-teams|step=1&tab=teams"
  "P3-edit|step=1&tab=series&demo=edit"
  "P4-import|step=1&tab=series&modal=import"
  "P5-review|step=2&tab=check"
  "P5-running|step=2&tab=run&run=hold"
  "P6-result|step=3&tab=calendar&month=5&sel=88"
  "P6-filter|step=3&tab=calendar&month=5&filter=LG"
  "P6-slotlist|step=3&tab=slots"
  "P5-blocked|step=2&tab=check&demo=block"
  "P7-quality|step=4&tab=metrics"
  "P7-charts|step=4&tab=charts"
  "P7-schedule|step=4&tab=schedule&team=LG"
  "P8-ops-games|view=ops&tab=games"
  "P8-ops-resched|view=ops&tab=resched&demo=resched"
  "P9-settings|step=3&tab=calendar&modal=settings"
)
want=("$@")
: > "$TMP/check.txt"
for s in "${SCREENS[@]}"; do
  name="${s%%|*}"; hash="${s#*|}"
  if [ ${#want[@]} -gt 0 ]; then ok=0; for w in "${want[@]}"; do [ "$w" = "$name" ] && ok=1; done; [ $ok = 1 ] || continue; fi
  for size in "1440,790" "1920,970"; do
    w="${size%,*}"; h="${size#*,}"; dsize="$w,$((h+87))"   # --dump-dom 창은 브라우저 틀 87px를 뺀 뷰포트가 된다
    url="file://$ROOT/index.html?fresh=1&check=1#$hash"
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$TMP/chrome" --window-size=$size --virtual-time-budget=2500 --screenshot="$ROOT/shots/$name-$w.png" "$url" >/dev/null 2>&1
    res=$("$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$TMP/chrome" --window-size=$dsize --virtual-time-budget=2500 --dump-dom "$url" 2>/dev/null | sed -n 's/.*<pre id="sp-check-result">\(.*\)<\/pre>.*/\1/p' | sed 's/&quot;/"/g')
    echo "$name $w $res" | tee -a "$TMP/check.txt"
  done
done
