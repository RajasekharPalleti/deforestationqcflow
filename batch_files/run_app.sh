#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$SCRIPT_DIR/app.pid"

cd "$PROJECT_DIR"

if ! command -v npm >/dev/null 2>&1; then
    echo "Node.js/npm was not found on PATH. Install Node.js from https://nodejs.org and try again."
    exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
    echo "Python 3 was not found on PATH. Install Python 3 and try again."
    exit 1
fi

if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo "First-time setup: installing root dependencies..."
    npm install
fi
if [ ! -d "$PROJECT_DIR/frontend/node_modules" ]; then
    echo "First-time setup: installing frontend dependencies..."
    npm run install:frontend
fi
if [ ! -f "$PROJECT_DIR/backend/.venv/bin/python" ]; then
    echo "First-time setup: creating backend virtual environment..."
    npm run setup:backend
fi

echo "Starting CropIn Model Validation Tool (backend + frontend)..."
nohup npm start > "$SCRIPT_DIR/app.log" 2>&1 &
echo $! > "$PID_FILE"

echo "App starting (PID $(cat "$PID_FILE")). Backend: http://localhost:8000  Frontend: http://localhost:4200"
