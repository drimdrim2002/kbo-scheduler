#!/bin/bash
# usage: check.sh W H "hash"  -> prints data-scroll and data-errors
W=$1; H=$2; HASH=$3; NAME=${4:-chk}
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROF=/private/tmp/claude-501/wizard-final/chrome-$NAME-$W-$$
rm -rf "$PROF"
"$CH" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --user-data-dir="$PROF" --window-size=$W,$H --virtual-time-budget=3000 --dump-dom "file://$ROOT/index.html?debug=scroll#$HASH" 2>/dev/null | grep -o 'data-scroll="[^"]*"\|data-errors="[^"]*"\|data-error-list="[^"]*"' | tr '\n' ' '
echo
