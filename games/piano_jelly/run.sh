#!/usr/bin/env bash
# Serves the visualizer on localhost and opens it full-screen in a dedicated Chrome window.
# Quit with Cmd+Q.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8765}"
ORIGIN="http://127.0.0.1:${PORT}"
PROFILE="${HOME}/.aurora-midi-chrome"
if ! lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  cd "$DIR"
  nohup python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/aurora-server.log 2>&1 &
  disown
  for _ in $(seq 1 40); do
    curl -fs "$ORIGIN/index.html" >/dev/null 2>&1 && break
    sleep 0.1
  done
fi

# Pre-grant Web MIDI for this origin in the dedicated profile so no prompt appears.
mkdir -p "$PROFILE/Default"
PREFS="$PROFILE/Default/Preferences"
python3 - "$PREFS" "$ORIGIN" <<'PY'
import json, os, sys
path, origin = sys.argv[1], sys.argv[2]
prefs = {}
if os.path.exists(path):
    try:
        prefs = json.load(open(path))
    except Exception:
        prefs = {}
ex = prefs.setdefault("profile", {}).setdefault("content_settings", {}).setdefault("exceptions", {})
for key in ("midi", "midi_sysex", "media_stream_mic"):
    ex.setdefault(key, {})[f"{origin},*"] = {"setting": 1}
prefs.setdefault("browser", {})["has_seen_welcome_page"] = True
json.dump(prefs, open(path, "w"))
PY

open -na "Google Chrome" --args \
  --user-data-dir="$PROFILE" \
  --app="$ORIGIN/index.html" \
  --kiosk \
  --start-fullscreen \
  --no-first-run \
  --no-default-browser-check \
  --disable-session-crashed-bubble \
  --disable-features=Translate,TranslateUI \
  --use-fake-ui-for-media-stream \
  --autoplay-policy=no-user-gesture-required \
  --enable-gpu-rasterization \
  --ignore-gpu-blocklist

echo "Aurora is running at $ORIGIN (Cmd+Q to quit)."
