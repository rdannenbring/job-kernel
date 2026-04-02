#!/bin/bash
# Start both backend and frontend with Cloudflare HTTPS tunnels for mobile PWA testing.
# Creates HTTPS tunnels for both the backend API and the frontend,
# which is required for Android/iOS to register the PWA share target.
#
# Usage: ./start-mobile-test.sh
# Then scan the QR code on your phone and install the PWA.

set -e

FRONTEND_PORT=5173
BACKEND_PORT=8000

echo "📱 Starting mobile PWA test environment..."
echo ""

# Kill any existing processes on the ports
lsof -ti:$FRONTEND_PORT 2>/dev/null | xargs -r kill 2>/dev/null || true

# ── Step 1: Ensure the backend is running ──
echo "🔍 Checking backend on port $BACKEND_PORT..."
if ! curl -s http://localhost:$BACKEND_PORT/ > /dev/null 2>&1; then
  echo "⚠️  Backend not running. Starting backend + database via Docker..."
  cd "$(dirname "$0")"
  docker compose up -d db backend 2>&1 | tail -5
  echo "⏳ Waiting for backend to start..."
  for i in $(seq 1 20); do
    if curl -s http://localhost:$BACKEND_PORT/ > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  if ! curl -s http://localhost:$BACKEND_PORT/ > /dev/null 2>&1; then
    echo "❌ Backend failed to start. Check Docker logs."
    exit 1
  fi
fi
echo "✅ Backend is running."

# ── Step 2: Create tunnel for the backend API ──
BACKEND_LOG=$(mktemp)
echo "🔒 Creating backend HTTPS tunnel..."
/tmp/cloudflared tunnel --url http://localhost:$BACKEND_PORT --no-tls-verify 2>"$BACKEND_LOG" &
BACKEND_TUNNEL_PID=$!

# Wait and extract the backend tunnel URL
BACKEND_URL=""
for i in $(seq 1 15); do
  BACKEND_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$BACKEND_LOG" 2>/dev/null | head -1)
  if [ -n "$BACKEND_URL" ]; then
    break
  fi
  sleep 1
done

if [ -z "$BACKEND_URL" ]; then
  echo "❌ Could not detect backend tunnel URL."
  cat "$BACKEND_LOG"
  kill $BACKEND_TUNNEL_PID 2>/dev/null
  exit 1
fi
echo "✅ Backend tunnel: $BACKEND_URL"

# ── Step 3: Start Vite with the backend tunnel URL ──
echo "🚀 Starting Vite dev server (API → $BACKEND_URL)..."
cd "$(dirname "$0")/frontend"
VITE_API_URL="$BACKEND_URL" npx vite --host --port $FRONTEND_PORT &
VITE_PID=$!
sleep 3

# ── Step 4: Create tunnel for the frontend ──
FRONTEND_LOG=$(mktemp)
echo "🔒 Creating frontend HTTPS tunnel..."
/tmp/cloudflared tunnel --url http://localhost:$FRONTEND_PORT --no-tls-verify 2>"$FRONTEND_LOG" &
FRONTEND_TUNNEL_PID=$!

# Wait and extract the frontend tunnel URL
FRONTEND_URL=""
for i in $(seq 1 15); do
  FRONTEND_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$FRONTEND_LOG" 2>/dev/null | head -1)
  if [ -n "$FRONTEND_URL" ]; then
    break
  fi
  sleep 1
done

if [ -z "$FRONTEND_URL" ]; then
  echo "❌ Could not detect frontend tunnel URL."
  cat "$FRONTEND_LOG"
  kill $VITE_PID $BACKEND_TUNNEL_PID $FRONTEND_TUNNEL_PID 2>/dev/null
  exit 1
fi

# ── Step 5: Show QR code ──
echo ""
echo "════════════════════════════════════════════════════════"
echo "  📱 Scan this QR code with your phone:"
echo "════════════════════════════════════════════════════════"
echo ""
qrencode -t ANSIUTF8 "$FRONTEND_URL"
echo ""
echo "  🌐 Frontend: $FRONTEND_URL"
echo "  🔧 Backend:  $BACKEND_URL"
echo ""
echo "════════════════════════════════════════════════════════"
echo "  📲 Install PWA: Chrome menu → 'Install app'"
echo "  🔗 Then share a job URL to 'JobKernel'"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop."

# Cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Stopping..."
  kill $VITE_PID 2>/dev/null
  kill $BACKEND_TUNNEL_PID 2>/dev/null
  kill $FRONTEND_TUNNEL_PID 2>/dev/null
  rm -f "$BACKEND_LOG" "$FRONTEND_LOG"
  exit 0
}
trap cleanup INT TERM

wait
