#!/bin/bash
# 첫 화면 대본 그림 만들기. usage: render.sh <v> <w>  -> out/script-<v>-<w>.png + .webp (2배 해상도, 투명 배경)
#   v = a(빨간 펜 동그라미+메모, 스테이플, 살짝 기울임 = 쓰는 것) / b(형광펜+파란 볼펜, 철 구멍, 수평) / c(연필 동그라미+포스트잇)
#   w = 343(휴대폰: 375 - 좌우 16) / 688(PC: 720 - 좌우 16)
# 쓰는 그림: a 343 → ui/show/stove-script-m.webp, a 688 → ui/show/stove-script-pc.webp. 손글씨 글꼴(Nanum Pen Script)은 구글 폰트라 인터넷이 필요하다.
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE="$(cd "$(dirname "$0")" && pwd)"; mkdir -p "$HERE/out"
V=$1; W=$2; PROF=$HERE/prof-$V-$W; rm -rf "$PROF"
URL="file://$HERE/render.html?w=$W&v=$V"
H=$("$CH" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$PROF" --window-size=$W,1400 --virtual-time-budget=9000 --dump-dom "$URL" 2>/dev/null | grep -o 'data-h="[0-9]*"' | head -1 | grep -o '[0-9]*')
echo "h=$H"
"$CH" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$PROF" --default-background-color=00000000 --force-device-scale-factor=2 --window-size=$W,$H --virtual-time-budget=9000 --screenshot="$HERE/out/script-$V-$W.png" "$URL" >/dev/null 2>&1
rm -rf "$PROF"
cwebp -quiet -q 86 -alpha_q 100 -m 6 "$HERE/out/script-$V-$W.png" -o "$HERE/out/script-$V-$W.webp" && ls -la "$HERE/out/script-$V-$W.png" "$HERE/out/script-$V-$W.webp"
