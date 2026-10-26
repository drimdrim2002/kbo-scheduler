#!/bin/bash
# usage: shot.sh name "hash" [w] -> shots/name-W.png (viewport 1440x790 / 1920x970)
NAME=$1; HASH=$2; ONLY=$3
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p $ROOT/shots
for W in 1440 1920; do
  [ -n "$ONLY" ] && [ "$ONLY" != "$W" ] && continue
  if [ $W = 1440 ]; then H=790; else H=970; fi
  PROF=/private/tmp/claude-501/wizard-final/chrome-shot-$NAME-$W-$$
  rm -rf "$PROF"
  "$CH" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROF" --window-size=$W,$H --virtual-time-budget=3000 --screenshot=$ROOT/shots/$NAME-$W.png "file://$ROOT/index.html#$HASH" >/dev/null 2>&1
  rm -rf "$PROF"
done
