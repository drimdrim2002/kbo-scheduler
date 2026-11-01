#!/bin/bash
# usage: shot.sh <file.html> [w h] -> shots/<name>.png (기본 1440×877)
F=$1; W=${2:-1440}; H=${3:-877}
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")" && pwd)"
NAME=$(basename "$F" .html)
mkdir -p "$ROOT/shots"
PROF=/private/tmp/claude-501/step-flow-concepts/chrome-$NAME-$$
rm -rf "$PROF"
"$CH" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROF" --window-size=$W,$H --virtual-time-budget=2000 --screenshot="$ROOT/shots/$NAME.png" "file://$ROOT/$F" >/dev/null 2>&1
rm -rf "$PROF"
echo "shots/$NAME.png"
