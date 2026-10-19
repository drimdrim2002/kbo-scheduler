#!/bin/bash
# 필수 화면 P1~P9 캡처 + 스크롤 점검 (1440×790, 1920×970)
cd "$(dirname "$0")/.."
LIST="
p1-rail-collapsed|#step=3&rail=collapsed&sel=35
p2-season|#step=1&tab=season
p2-slots|#step=1&tab=slots
p2-events|#step=1&tab=events
p2-teams|#step=1&tab=teams
p3-edit-series|#step=1&tab=series&edit=demo
p3-edit-slots|#step=1&tab=slots&edit=demo
p4-import|#step=1&tab=slots&modal=import
p4-import-confirm|#step=1&tab=slots&modal=import&stage=confirm
p4-gsheet|#step=1&tab=slots&modal=gsheet
p5-review|#step=2
p5-running|#step=2&run=frozen
p6-result|#step=3&sel=35
p6-filter|#step=3&team=LG&sel=74
p6-list|#step=3&tab=list
p7-metrics|#step=4&tab=metrics
p7-charts|#step=4&tab=charts
p7-charts-a3|#step=4&tab=charts&chart=A3
p7-schedule|#step=4&tab=schedule
p7-export|#step=4&tab=export
p8-ops-games|#view=ops&tab=games
p8-ops-reschedule|#view=ops&tab=reschedule&result=1
p9-settings|#view=settings
"
mode="${1:-both}"
for line in $LIST; do
  name="${line%%|*}"; hash="${line#*|}"
  for sz in "1440 790" "1920 970"; do
    set -- $sz
    if [ "$mode" != check ]; then tools/shots.sh shot "$name" "$hash" $1 $2 >/dev/null; fi
    if [ "$mode" != shot ]; then r=$(tools/shots.sh check "$hash" $1 $2 | head -1); echo "$name $1 $r"; fi
  done
done
