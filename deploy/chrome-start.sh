#!/bin/sh
# Start Chrome + socat bridge so other containers can reach CDP on port 9223.
# Chrome binds to 127.0.0.1:9222 (cannot be overridden reliably).
# socat forwards 0.0.0.0:9223 → 127.0.0.1:9222 for inter-container access.

google-chrome-stable \
  --headless=new \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --remote-debugging-port=9222 \
  --remote-debugging-address=0.0.0.0 \
  --user-data-dir=/data/chrome-profile \
  --disable-blink-features=AutomationControlled \
  --remote-allow-origins=* \
  ${SOCKS5_PROXY_URL:+--proxy-server=$SOCKS5_PROXY_URL} &

CHROME_PID=$!
echo "[chrome-start] Chrome PID=$CHROME_PID, waiting for CDP..."
sleep 4

socat TCP4-LISTEN:9223,fork,reuseaddr TCP4:127.0.0.1:9222 &
echo "[chrome-start] socat bridge: 0.0.0.0:9223 -> 127.0.0.1:9222"

wait $CHROME_PID
