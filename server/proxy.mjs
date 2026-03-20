import http from "node:http";

const PROXY_PORT = 8080;
const SSE_PORT = 4040;
const TARGET_PORT = 3001;
const MAX_ENTRIES = 200;

/** @type {Array<object>} */
const buffer = [];
/** @type {Set<http.ServerResponse>} */
const sseClients = new Set();

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function tryParseJson(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

function addEntry(entry) {
  buffer.unshift(entry);
  if (buffer.length > MAX_ENTRIES) buffer.pop();
  broadcast("response", entry);
}

// ── Proxy server on :8080 ──────────────────────────────────────────────

const proxyServer = http.createServer((req, res) => {
  const id = generateId();
  const startedAt = new Date().toISOString();
  const start = performance.now();

  const reqChunks = [];

  req.on("data", (chunk) => reqChunks.push(chunk));
  req.on("end", () => {
    const reqBodyRaw = Buffer.concat(reqChunks).toString("utf-8");
    const reqBody = tryParseJson(reqBodyRaw);

    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: TARGET_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        const resChunks = [];
        proxyRes.on("data", (chunk) => resChunks.push(chunk));
        proxyRes.on("end", () => {
          const duration = Math.round(performance.now() - start);
          const resBodyRaw = Buffer.concat(resChunks).toString("utf-8");
          const resBody = tryParseJson(resBodyRaw);

          addEntry({
            id,
            method: req.method,
            url: req.url,
            status: proxyRes.statusCode,
            duration,
            startedAt,
            reqHeaders: { ...req.headers },
            reqBody,
            resHeaders: { ...proxyRes.headers },
            resBody,
          });

          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          res.end(Buffer.concat(resChunks));
        });
      }
    );

    proxyReq.on("error", (err) => {
      const duration = Math.round(performance.now() - start);
      addEntry({
        id,
        method: req.method,
        url: req.url,
        status: 502,
        duration,
        startedAt,
        reqHeaders: { ...req.headers },
        reqBody,
        resHeaders: {},
        resBody: null,
        error: err.message,
      });
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end(`Proxy error: ${err.message}`);
    });

    if (reqChunks.length > 0) {
      proxyReq.write(Buffer.concat(reqChunks));
    }
    proxyReq.end();
  });
});

// ── SSE + API server on :4040 ──────────────────────────────────────────

const sseServer = http.createServer((req, res) => {
  // CORS headers for the Next.js frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Send full history on connect
    res.write(`event: history\ndata: ${JSON.stringify(buffer)}\n\n`);

    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  if (req.url === "/api/requests") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(buffer));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

proxyServer.listen(PROXY_PORT, () => {
  console.log(`🔀 Proxy listening on :${PROXY_PORT} → forwarding to :${TARGET_PORT}`);
});

sseServer.listen(SSE_PORT, () => {
  console.log(`📡 SSE/API server listening on :${SSE_PORT}`);
});
