#!/bin/sh
# Start Chrome + CDP proxy so other containers can reach Chrome on port 9223.
# Chrome binds to 127.0.0.1:9222 and rejects non-localhost Host headers.
# chrome-proxy.js rewrites Host headers and proxies HTTP + WebSocket.

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

node /app/deploy/chrome-proxy.js &
echo "[chrome-start] CDP proxy started on :9223"

wait $CHROME_PID
