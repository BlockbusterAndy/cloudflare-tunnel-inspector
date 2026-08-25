import http from "node:http";
import { readFileSync } from "node:fs";
import { resolveConfig, isAllowedOrigin } from "./config.mjs";
import { createCollector, buildBody, redactHeaders } from "./capture.mjs";

/** Single source of truth for the version, so bug reports can name one. */
export const VERSION = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8")
).version;

let config;
try {
  config = resolveConfig();
} catch (err) {
  console.error(`✖ ${err.message}`);
  console.error("  See README.md for available flags.");
  process.exit(1);
}

const REPLAY_HEADER = "x-tunnel-inspector-replay";
const HEARTBEAT_MS = 20_000;

/** @type {Array<object>} newest first */
const buffer = [];
/** @type {Set<http.ServerResponse>} */
const sseClients = new Set();

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function round(ms) {
  return Number(ms.toFixed(2));
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

function addEntry(entry) {
  buffer.unshift(entry);
  if (buffer.length > config.maxEntries) buffer.pop();
  broadcast("response", entry);
}

// ── Proxy server ───────────────────────────────────────────────────────

/** Headers sent upstream: forwarding info added, everything else passed through. */
function buildUpstreamHeaders(req) {
  const headers = { ...req.headers };
  const remote = req.socket.remoteAddress ?? "";
  const existing = headers["x-forwarded-for"];

  headers["x-forwarded-for"] = existing ? `${existing}, ${remote}` : remote;
  headers["x-forwarded-proto"] ??= "http";
  headers["x-forwarded-host"] ??= headers.host ?? "";

  if (config.rewriteHost) {
    headers.host = `${config.targetHost}:${config.targetPort}`;
  }
  return headers;
}

const proxyServer = http.createServer((req, res) => {
  const id = generateId();
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const replayed = req.headers[REPLAY_HEADER] === "1";

  const reqCollector = createCollector(config.maxBodyBytes);
  const resCollector = createCollector(config.maxBodyBytes);

  // Streamed responses (SSE, chunked APIs) must not sit in a Nagle buffer.
  req.socket.setNoDelay(true);

  const record = (extra) => {
    const request = buildBody(reqCollector, req.headers);
    addEntry({
      id,
      method: req.method,
      url: req.url,
      startedAt,
      replayed,
      reqHeaders: redactHeaders(req.headers, config.redact),
      reqBody: request.body,
      reqBodySize: request.size,
      reqBodyTruncated: request.truncated,
      reqBodyBinary: request.binary,
      ...extra,
    });
  };

  const proxyReq = http.request(
    {
      hostname: config.targetHost,
      port: config.targetPort,
      path: req.url,
      method: req.method,
      headers: buildUpstreamHeaders(req),
    },
    (proxyRes) => {
      const ttfb = round(performance.now() - start);

      // Head the response before any body arrives so streaming stays streaming.
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      res.flushHeaders?.();

      proxyRes.on("data", (chunk) => resCollector.push(chunk));
      proxyRes.pipe(res);

      proxyRes.on("end", () => {
        const response = buildBody(resCollector, proxyRes.headers);
        record({
          status: proxyRes.statusCode,
          duration: round(performance.now() - start),
          ttfb,
          resHeaders: redactHeaders(proxyRes.headers, config.redact),
          resBody: response.body,
          resBodySize: response.size,
          resBodyTruncated: response.truncated,
          resBodyBinary: response.binary,
        });
      });

      proxyRes.on("error", () => res.destroy());
    }
  );

  proxyReq.on("error", (err) => {
    record({
      status: 502,
      duration: round(performance.now() - start),
      ttfb: null,
      resHeaders: {},
      resBody: null,
      resBodySize: 0,
      resBodyTruncated: false,
      resBodyBinary: false,
      error: err.message,
    });
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end(`Proxy error: ${err.message}`);
    } else {
      res.destroy();
    }
  });

  req.on("data", (chunk) => reqCollector.push(chunk));
  req.on("aborted", () => proxyReq.destroy());
  req.pipe(proxyReq);
});

// ── WebSocket / protocol upgrades ──────────────────────────────────────

proxyServer.on("upgrade", (req, clientSocket, head) => {
  const id = generateId();
  const startedAt = new Date().toISOString();
  const start = performance.now();

  const logUpgrade = (status, resHeaders, error) => {
    addEntry({
      id,
      method: req.method,
      url: req.url,
      status,
      duration: round(performance.now() - start),
      ttfb: null,
      startedAt,
      upgrade: true,
      protocol: "websocket",
      reqHeaders: redactHeaders(req.headers, config.redact),
      reqBody: null,
      reqBodySize: 0,
      reqBodyTruncated: false,
      reqBodyBinary: false,
      resHeaders: redactHeaders(resHeaders, config.redact),
      resBody: null,
      resBodySize: 0,
      resBodyTruncated: false,
      resBodyBinary: false,
      ...(error ? { error } : {}),
    });
  };

  const upstream = http.request({
    hostname: config.targetHost,
    port: config.targetPort,
    path: req.url,
    method: req.method,
    headers: buildUpstreamHeaders(req),
  });

  upstream.on("upgrade", (upstreamRes, upstreamSocket, upstreamHead) => {
    const lines = [`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}`];
    for (let i = 0; i < upstreamRes.rawHeaders.length; i += 2) {
      lines.push(`${upstreamRes.rawHeaders[i]}: ${upstreamRes.rawHeaders[i + 1]}`);
    }
    clientSocket.write(`${lines.join("\r\n")}\r\n\r\n`);

    clientSocket.setNoDelay(true);
    upstreamSocket.setNoDelay(true);

    if (upstreamHead?.length) clientSocket.write(upstreamHead);
    if (head?.length) upstreamSocket.write(head);

    upstreamSocket.pipe(clientSocket);
    clientSocket.pipe(upstreamSocket);

    const close = () => {
      upstreamSocket.destroy();
      clientSocket.destroy();
    };
    upstreamSocket.on("error", close);
    clientSocket.on("error", close);

    logUpgrade(upstreamRes.statusCode, upstreamRes.headers);
  });

  upstream.on("response", (upstreamRes) => {
    // Target refused to upgrade — pass its answer back verbatim and stop.
    const lines = [`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}`];
    for (let i = 0; i < upstreamRes.rawHeaders.length; i += 2) {
      lines.push(`${upstreamRes.rawHeaders[i]}: ${upstreamRes.rawHeaders[i + 1]}`);
    }
    clientSocket.write(`${lines.join("\r\n")}\r\n\r\n`);
    upstreamRes.pipe(clientSocket);
    logUpgrade(upstreamRes.statusCode, upstreamRes.headers, "upgrade refused by target");
  });

  upstream.on("error", (err) => {
    logUpgrade(502, {}, err.message);
    clientSocket.destroy();
  });

  clientSocket.on("error", () => upstream.destroy());
  upstream.end();
});

// ── Inspector SSE + API server ─────────────────────────────────────────

function readJsonBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Re-issue a request through the proxy, so the replay is captured exactly
 * like organic traffic and shows up in the feed on its own.
 */
function replay(entry) {
  return new Promise((resolve, reject) => {
    const headers = {};
    for (const [key, value] of Object.entries(entry.headers ?? {})) {
      const lower = key.toLowerCase();
      // Drop stale framing headers; http.request recomputes them.
      if (lower === "content-length" || lower === "transfer-encoding") continue;
      headers[key] = value;
    }
    headers[REPLAY_HEADER] = "1";

    const body =
      entry.body === null || entry.body === undefined || entry.body === ""
        ? null
        : Buffer.from(
            typeof entry.body === "string" ? entry.body : JSON.stringify(entry.body),
            "utf-8"
          );

    const request = http.request(
      {
        hostname: config.proxyHost === "0.0.0.0" ? "127.0.0.1" : config.proxyHost,
        port: config.proxyPort,
        path: entry.url ?? "/",
        method: entry.method ?? "GET",
        headers,
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      }
    );
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

const inspectorServer = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    if (!isAllowedOrigin(origin, config.allowOrigin)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Origin not allowed");
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const path = (req.url ?? "/").split("?")[0];

  if (path === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    res.write("retry: 2000\n\n");
    res.write(`event: history\ndata: ${JSON.stringify(buffer)}\n\n`);

    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  if (path === "/api/requests") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(buffer));
    return;
  }

  if (path === "/api/config") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        version: VERSION,
        proxyPort: config.proxyPort,
        targetHost: config.targetHost,
        targetPort: config.targetPort,
        maxEntries: config.maxEntries,
        maxBodyBytes: config.maxBodyBytes,
        redacting: config.redact.length > 0,
        redactedHeaders: config.redact,
      })
    );
    return;
  }

  if (path === "/api/clear" && req.method === "DELETE") {
    buffer.length = 0;
    broadcast("history", []);
    res.writeHead(204);
    res.end();
    return;
  }

  if (path === "/api/replay" && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const status = await replay(payload);
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, status }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

// Keeps idle SSE connections from being dropped by the OS or an intermediary.
const heartbeat = setInterval(() => {
  for (const client of sseClients) client.write(": ping\n\n");
}, HEARTBEAT_MS);
heartbeat.unref();

// ── Startup ────────────────────────────────────────────────────────────

function onListenError(label, host, port) {
  return (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`✖ ${label} cannot start: ${host}:${port} is already in use.`);
      console.error("  Stop whatever is using it, or pass a different port flag.");
    } else if (err.code === "EACCES") {
      console.error(`✖ ${label} cannot bind ${host}:${port} — permission denied.`);
    } else {
      console.error(`✖ ${label} failed to start: ${err.message}`);
    }
    process.exit(1);
  };
}

proxyServer.on("error", onListenError("Proxy", config.proxyHost, config.proxyPort));
inspectorServer.on("error", onListenError("Inspector API", config.inspectorHost, config.inspectorPort));

console.log(`
Tunnel Inspector v${VERSION}`);

proxyServer.listen(config.proxyPort, config.proxyHost, () => {
  console.log(
    `🔀 Proxy     http://${config.proxyHost}:${config.proxyPort} → http://${config.targetHost}:${config.targetPort}`
  );
});

inspectorServer.listen(config.inspectorPort, config.inspectorHost, () => {
  console.log(`📡 Inspector http://${config.inspectorHost}:${config.inspectorPort}  (SSE + API)`);
  if (config.redact.length > 0) {
    console.log(`🔒 Redacting headers: ${config.redact.join(", ")}`);
  }
});

function shutdown() {
  clearInterval(heartbeat);
  for (const client of sseClients) client.end();
  proxyServer.close();
  inspectorServer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
