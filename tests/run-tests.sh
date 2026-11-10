#!/usr/bin/env bash
# Runs the BatStat test page in headless Edge or Chrome and prints the results.
# Usage (from the project folder):  bash tests/run-tests.sh
# Exit code: 0 when every test passes, 1 when any test fails, 2 when no browser is found.
set -u

here="$(cd "$(dirname "$0")" && pwd)"

browser=""
for candidate in \
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  "/c/Program Files/Microsoft/Edge/Application/msedge.exe" \
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
  "$(command -v google-chrome 2>/dev/null)" \
  "$(command -v chromium 2>/dev/null)" \
  "$(command -v microsoft-edge 2>/dev/null)"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then browser="$candidate"; break; fi
done
if [ -z "$browser" ]; then
  echo "No Edge or Chrome found. Open tests/index.html through the local server instead." >&2
  exit 2
fi

# file:// URL of the test page (Windows paths need a drive-letter form).
if command -v cygpath >/dev/null 2>&1; then
  page="file:///$(cygpath -m "$here/index.html")"
else
  page="file://$here/index.html"
fi

# The flags let a file:// page read the dashboard frame; they apply only to this throwaway headless run.
dom="$("$browser" --headless=new --disable-gpu --no-first-run --allow-file-access-from-files \
  --disable-web-security --window-size=1500,1000 --virtual-time-budget=180000 \
  --dump-dom "$page" 2>/dev/null)"

report="$(printf '%s' "$dom" | sed -n '/<pre id="report">/,/<\/pre>/p' \
  | sed -e 's/<[^>]*>//g' -e 's/&gt;/>/g' -e 's/&lt;/</g' -e 's/&amp;/\&/g' -e 's/&quot;/"/g')"

if [ -z "$report" ]; then
  echo "The test page did not finish. Open tests/index.html through the local server to see why." >&2
  exit 1
fi

printf '%s\n' "$report"
case "$report" in
  *"RESULT: "*" 0 failed"*) exit 0 ;;
  *) exit 1 ;;
esac
