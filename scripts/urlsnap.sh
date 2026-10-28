#!/usr/bin/env bash
# Print a normalised snapshot of every URL-bearing fact in a built site dir:
# output paths, sitemap <loc>, RSS <link>, canonical and og:url.
# Fingerprinted asset names are normalised so hash changes do not show up.
# Usage: scripts/urlsnap.sh <built-site-dir>
set -euo pipefail
d=${1:?usage: urlsnap.sh <built-site-dir>}
cd "$d"
echo "## paths"
find . -type f | sort | sed -E 's#\.[0-9a-f]{64}\.#.HASH.#'
echo "## sitemap and rss"
for f in sitemap.xml index.xml; do grep -o '<loc>[^<]*</loc>\|<link>[^<]*</link>' "$f" | sort; done
echo "## canonical and og:url"
grep -rho 'rel=canonical href=[^ >]*\|property="og:url" content="[^"]*"' --include=index.html . | sort
