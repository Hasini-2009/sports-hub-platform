#!/usr/bin/env bash
set -e

echo "===================================================="
echo "Starting Sports Hub Platform Services..."
echo "===================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Check if venv exists
if [ -d "$BACKEND_DIR/venv" ]; then
    PYTHON_BIN="$BACKEND_DIR/venv/bin/python"
    UVICORN_BIN="$BACKEND_DIR/venv/bin/uvicorn"
else
    PYTHON_BIN="python3"
    UVICORN_BIN="uvicorn"
fi

echo "[1/2] Launching Backend on http://127.0.0.1:8000..."
(
    cd "$BACKEND_DIR"
    export PYTHONPATH="$BACKEND_DIR"
    $UVICORN_BIN app.main:app --host 0.0.0.0 --port 8000 --reload
) &
BACKEND_PID=$!

echo "[2/2] Launching Next.js Frontend on http://localhost:3000..."
(
    cd "$FRONTEND_DIR"
    npm run dev
) &
FRONTEND_PID=$!

cleanup() {
    echo "Stopping Sports Hub services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

echo ""
echo "Sports Hub Platform running:"
echo "• Frontend: http://localhost:3000"
echo "• Backend Docs: http://localhost:8000/docs"
echo "• Health: http://localhost:8000/health"
echo "Press CTRL+C to terminate all services."

wait

