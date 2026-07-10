#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$SCRIPT_DIR/app.pid"

cd "$PROJECT_DIR"

echo "Stopping CropIn Model Validation Tool..."

# Kill the process tree started by run_app.sh, if it's still around. run_app.sh
# runs with job control on, so PID is also the process group id — killing the
# whole group (the negative PID form) catches every descendant in one shot,
# not just direct children.
if [ -f "$PID_FILE" ]; then
    PID="$(cat "$PID_FILE")"
    if [ -n "$PID" ] && kill -0 "$PID" >/dev/null 2>&1; then
        kill -- "-$PID" >/dev/null 2>&1 || true
        pkill -P "$PID" >/dev/null 2>&1 || true
        kill "$PID" >/dev/null 2>&1 || true
    fi
    rm -f "$PID_FILE"
fi

# Authoritative cleanup: sweep whatever is actually bound to the backend (8000)
# and frontend (4200) ports, in case the tool wasn't started via run_app.sh.
npm run stop

echo "App stopped."
