#!/usr/bin/env node
/**
 * Tiny HTTP + WebSocket reverse proxy for Chrome DevTools Protocol.
 *
 * Chrome binds to 127.0.0.1:9222 inside the container and rejects HTTP
 * requests whose Host header is not localhost/127.0.0.1.  Other containers
 * connect via the Docker service name "chrome", which Chrome rejects.
 *
 * This proxy:
 *   - Listens on 0.0.0.0:9223
 *   - Rewrites the Host header to 127.0.0.1:9222 on every request
 *   - Rewrites ws/http URLs in JSON responses so clients reconnect via proxy
 *   - Tunnels WebSocket upgrades transparently
 */

"use strict";
const http = require("http");
const net  = require("net");

const TARGET_HOST = "127.0.0.1";
const TARGET_PORT = 9222;
const LISTEN_PORT = 9223;
const PROXY_HOST  = process.env.PROXY_HOST || "chrome"; // how clients see us

const server = http.createServer((req, res) => {
  const opts = {
    hostname: TARGET_HOST,
    port:     TARGET_PORT,
    path:     req.url,
    method:   req.method,
    headers:  { ...req.headers, host: `${TARGET_HOST}:${TARGET_PORT}` },
  };

  const proxy = http.request(opts, (upstream) => {
    const chunks = [];
    upstream.on("data", (c) => chunks.push(c));
    upstream.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      // Rewrite internal CDP URLs so callers connect back through the proxy
      const rewritten = body
        .replace(/127\.0\.0\.1:9222/g, `${PROXY_HOST}:${LISTEN_PORT}`)
        .replace(/localhost:9222/g,     `${PROXY_HOST}:${LISTEN_PORT}`);
      const out = Buffer.from(rewritten, "utf8");
      res.writeHead(upstream.statusCode, {
        ...upstream.headers,
        "content-length": String(out.length),
      });
      res.end(out);
    });
  });

  proxy.on("error", (e) => { res.writeHead(502); res.end(e.message); });
  req.pipe(proxy);
});

// WebSocket tunnel — rewrite Host, pipe bytes transparently
server.on("upgrade", (req, clientSocket, head) => {
  const target = net.connect(TARGET_PORT, TARGET_HOST, () => {
    const filteredHeaders = Object.entries(req.headers)
      .filter(([k]) => k.toLowerCase() !== "host")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");

    target.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
      `Host: ${TARGET_HOST}:${TARGET_PORT}\r\n` +
      (filteredHeaders ? filteredHeaders + "\r\n" : "") +
      "\r\n"
    );
    if (head && head.length) target.write(head);

    target.pipe(clientSocket);
    clientSocket.pipe(target);
  });

  target.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => target.destroy());
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(
    `[chrome-proxy] 0.0.0.0:${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`
  );
});
