#!/usr/bin/env bash
# Rebuild the site into a temp dir and diff its URL snapshot against
# docs/url-baseline.txt (taken from the original typo-theme build).
# Never writes to build/main. Usage: scripts/urldiff.sh [hugo-binary]
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
hugo_bin=${1:-hugo}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
(cd "$root" && "$hugo_bin" --minify -d "$tmp/site" >/dev/null)
"$root/scripts/urlsnap.sh" "$tmp/site" > "$tmp/now.txt"
diff "$root/docs/url-baseline.txt" "$tmp/now.txt" && echo "URLs identical to baseline" || true
