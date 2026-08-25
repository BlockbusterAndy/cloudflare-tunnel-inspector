import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import net from "node:net";
import { readFileSync } from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HOST = "127.0.0.1";
const PROXY_SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "server",
  "proxy.mjs"
);

let upstream: http.Server;
let child: ChildProcess;
/** Every socket the fake upstream accepts, so teardown can force them closed. */
const upstreamSockets = new Set<net.Socket>();
let proxyPort = 0;
let inspectorPort = 0;
let targetPort = 0;

/** Bind port 0, read the assigned port, release it. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, HOST, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

function createUpstream(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";

    if (url.startsWith("/hello")) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("hello");
      return;
    }

    if (url.startsWith("/echo")) {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            method: req.method,
            headers: req.headers,
            body: Buffer.concat(chunks).toString("utf-8"),
          })
        );
      });
      return;
    }

    if (url.startsWith("/gzip")) {
      const payload = zlib.gzipSync(JSON.stringify({ compressed: true, n: 42 }));
      res.writeHead(200, { "Content-Type": "application/json", "Content-Encoding": "gzip" });
      res.end(payload);
      return;
    }

    if (url.startsWith("/png")) {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02]);
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(png);
      return;
    }

    if (url.startsWith("/big")) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("x".repeat(4096));
      return;
    }

    if (url.startsWith("/stream")) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.write("first");
      setTimeout(() => res.end("second"), 250);
      return;
    }

    if (url.startsWith("/boom")) {
      req.socket.destroy();
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("nope");
  });

  // Minimal WebSocket-ish upgrade: complete the handshake, then echo bytes.
  server.on("upgrade", (req, socket) => {
    const key = String(req.headers["sec-websocket-key"] ?? "");
    const accept = crypto
      .createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write(
      [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${accept}`,
        "\r\n",
      ].join("\r\n")
    );
    socket.on("data", (chunk) => socket.write(chunk));
  });

  server.on("connection", (socket) => {
    upstreamSockets.add(socket);
    socket.on("close", () => upstreamSockets.delete(socket));
  });

  return new Promise((resolve) => {
    server.listen(0, HOST, () => resolve(server));
  });
}

async function waitForReady(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://${HOST}:${inspectorPort}/api/config`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Proxy did not become ready in time");
}

/** Raw request against the proxy, so encoding is not silently undone by fetch. */
function rawRequest(
  options: http.RequestOptions,
  body?: string | Buffer
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: HOST, port: proxyPort, ...options }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) })
      );
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

interface Entry {
  id: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  ttfb: number | null;
  reqHeaders: Record<string, string>;
  reqBody: unknown;
  resHeaders: Record<string, string>;
  resBody: unknown;
  resBodySize: number;
  resBodyBinary: boolean;
  resBodyTruncated: boolean;
  replayed?: boolean;
  upgrade?: boolean;
  error?: string;
}

async function entries(): Promise<Entry[]> {
  const res = await fetch(`http://${HOST}:${inspectorPort}/api/requests`);
  return (await res.json()) as Entry[];
}

/** The buffer is written after the response completes, so poll briefly. */
async function waitForEntry(
  predicate: (entry: Entry) => boolean,
  timeoutMs = 5000
): Promise<Entry> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = (await entries()).find(predicate);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Timed out waiting for a matching capture entry");
}

beforeAll(async () => {
  upstream = await createUpstream();
  targetPort = (upstream.address() as net.AddressInfo).port;
  proxyPort = await freePort();
  inspectorPort = await freePort();

  child = spawn(
    process.execPath,
    [
      PROXY_SCRIPT,
      "--target-port",
      String(targetPort),
      "--proxy-port",
      String(proxyPort),
      "--inspector-port",
      String(inspectorPort),
      "--max-body-bytes",
      "1024",
      "--redact",
      "authorization",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  child.stderr?.on("data", (d) => console.error(`[proxy] ${d}`));

  await waitForReady();
}, 30_000);

afterAll(async () => {
  child?.kill();
  // Keep-alive and upgraded sockets would otherwise hold the server open.
  for (const socket of upstreamSockets) socket.destroy();
  upstreamSockets.clear();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

describe("proxying", () => {
  it("forwards requests and returns the upstream response", async () => {
    const res = await rawRequest({ path: "/hello", method: "GET" });
    expect(res.status).toBe(200);
    expect(res.body.toString()).toBe("hello");

    const entry = await waitForEntry((e) => e.url === "/hello");
    expect(entry.status).toBe(200);
    expect(entry.resBody).toBe("hello");
    expect(entry.ttfb).not.toBeNull();
    expect(entry.duration).toBeGreaterThanOrEqual(0);
  });

  it("adds forwarding headers and preserves the original Host", async () => {
    const res = await rawRequest({
      path: "/echo",
      method: "POST",
      headers: { "Content-Type": "application/json", Host: "tunnel.example.com" },
    }, JSON.stringify({ a: 1 }));

    const received = JSON.parse(res.body.toString()) as {
      headers: Record<string, string>;
      body: string;
    };
    expect(received.headers.host).toBe("tunnel.example.com");
    expect(received.headers["x-forwarded-for"]).toBeTruthy();
    expect(received.headers["x-forwarded-proto"]).toBe("http");
    expect(received.body).toBe(JSON.stringify({ a: 1 }));

    const entry = await waitForEntry((e) => e.url === "/echo");
    expect(entry.reqBody).toEqual({ a: 1 });
    expect(entry.status).toBe(201);
  });

  it("streams the response instead of buffering it", async () => {
    const timings = await new Promise<{ first: number; end: number }>((resolve, reject) => {
      const start = Date.now();
      let first = 0;
      const req = http.request({ host: HOST, port: proxyPort, path: "/stream" }, (res) => {
        res.on("data", () => {
          if (!first) first = Date.now() - start;
        });
        res.on("end", () => resolve({ first, end: Date.now() - start }));
      });
      req.on("error", reject);
      req.end();
    });

    // Upstream holds the second chunk for 250ms; the first must arrive well before.
    expect(timings.end).toBeGreaterThanOrEqual(200);
    expect(timings.first).toBeLessThan(timings.end - 100);
  });

  it("returns 502 and records the error when the target fails", async () => {
    const res = await rawRequest({ path: "/boom", method: "GET" });
    expect(res.status).toBe(502);

    const entry = await waitForEntry((e) => e.url === "/boom");
    expect(entry.status).toBe(502);
    expect(entry.error).toBeTruthy();
  });
});

describe("body capture", () => {
  it("passes compressed responses through untouched but captures them decoded", async () => {
    const res = await rawRequest({
      path: "/gzip",
      method: "GET",
      headers: { "Accept-Encoding": "gzip" },
    });
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(JSON.parse(zlib.gunzipSync(res.body).toString())).toEqual({ compressed: true, n: 42 });

    const entry = await waitForEntry((e) => e.url === "/gzip");
    expect(entry.resBody).toEqual({ compressed: true, n: 42 });
    expect(entry.resBodyBinary).toBe(false);
  });

  it("flags binary responses rather than storing mojibake", async () => {
    const res = await rawRequest({ path: "/png", method: "GET" });
    expect(res.body[0]).toBe(0x89);

    const entry = await waitForEntry((e) => e.url === "/png");
    expect(entry.resBodyBinary).toBe(true);
    expect(entry.resBody).toBeNull();
    expect(entry.resBodySize).toBe(11);
  });

  it("truncates oversized bodies at the cap without truncating the response", async () => {
    const res = await rawRequest({ path: "/big", method: "GET" });
    expect(res.body.length).toBe(4096);

    const entry = await waitForEntry((e) => e.url === "/big");
    expect(entry.resBodyTruncated).toBe(true);
    expect(entry.resBodySize).toBe(4096);
    expect(String(entry.resBody).length).toBe(1024);
  });
});

describe("redaction", () => {
  it("hides configured headers from the feed but still forwards them", async () => {
    const res = await rawRequest({
      path: "/echo?redact=1",
      method: "POST",
      headers: { Authorization: "Bearer super-secret", "Content-Type": "application/json" },
    }, "{}");

    const received = JSON.parse(res.body.toString()) as { headers: Record<string, string> };
    expect(received.headers.authorization).toBe("Bearer super-secret");

    const entry = await waitForEntry((e) => e.url === "/echo?redact=1");
    expect(entry.reqHeaders.authorization).toBe("«redacted»");
    expect(JSON.stringify(entry.reqHeaders)).not.toContain("super-secret");
  });
});

describe("websocket upgrades", () => {
  it("proxies the handshake and pipes frames both ways", async () => {
    const result = await new Promise<{ handshake: string; echo: string }>((resolve, reject) => {
      const socket = net.connect(proxyPort, HOST, () => {
        socket.write(
          [
            "GET /ws HTTP/1.1",
            `Host: ${HOST}:${proxyPort}`,
            "Upgrade: websocket",
            "Connection: Upgrade",
            "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version: 13",
            "\r\n",
          ].join("\r\n")
        );
      });

      let handshake = "";
      let echo = "";
      socket.on("data", (chunk) => {
        const text = chunk.toString();
        if (!handshake) {
          handshake = text;
          socket.write("ping-bytes");
          return;
        }
        echo += text;
        if (echo.includes("ping-bytes")) {
          socket.end();
          resolve({ handshake, echo });
        }
      });
      socket.on("error", reject);
      setTimeout(() => reject(new Error("upgrade timed out")), 5000);
    });

    expect(result.handshake).toContain("101 Switching Protocols");
    expect(result.handshake).toContain("Sec-WebSocket-Accept");
    expect(result.echo).toContain("ping-bytes");

    const entry = await waitForEntry((e) => e.url === "/ws");
    expect(entry.upgrade).toBe(true);
    expect(entry.status).toBe(101);
  });
});

describe("inspector API", () => {
  it("reports its configuration and version", async () => {
    const res = await fetch(`http://${HOST}:${inspectorPort}/api/config`);
    const config = (await res.json()) as {
      version: string;
      proxyPort: number;
      targetPort: number;
      redacting: boolean;
    };
    expect(config.proxyPort).toBe(proxyPort);
    expect(config.targetPort).toBe(targetPort);
    expect(config.redacting).toBe(true);

    // Must match package.json, which is what release-please bumps.
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf-8")
    ) as { version: string };
    expect(config.version).toBe(pkg.version);
  });

  it("refuses cross-origin callers", async () => {
    const res = await fetch(`http://${HOST}:${inspectorPort}/api/requests`, {
      headers: { Origin: "http://evil.example.com" },
    });
    expect(res.status).toBe(403);
  });

  it("allows loopback origins and echoes them back", async () => {
    const res = await fetch(`http://${HOST}:${inspectorPort}/api/requests`, {
      headers: { Origin: "http://localhost:3001" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3001");
  });

  it("replays a request through the proxy and captures it", async () => {
    const res = await fetch(`http://${HOST}:${inspectorPort}/api/replay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "GET", url: "/hello?replayed=yes", headers: {}, body: null }),
    });
    expect(res.status).toBe(202);

    const entry = await waitForEntry((e) => e.url === "/hello?replayed=yes");
    expect(entry.replayed).toBe(true);
    expect(entry.status).toBe(200);
  });

  it("sends history on connect and clears the buffer on demand", async () => {
    expect((await entries()).length).toBeGreaterThan(0);

    const history = await new Promise<string>((resolve, reject) => {
      let done = false;
      const finish = (value: string) => {
        done = true;
        resolve(value);
      };

      const req = http.request({ host: HOST, port: inspectorPort, path: "/events" }, (res) => {
        let buffered = "";
        res.on("data", (chunk) => {
          buffered += chunk.toString();
          if (!done && buffered.includes("event: history")) {
            finish(buffered);
            req.destroy();
          }
        });
      });
      req.on("error", (err) => {
        if (!done) reject(err);
      });
      req.end();
      setTimeout(() => {
        if (!done) reject(new Error("no history event"));
      }, 5000);
    });
    expect(history).toContain("event: history");

    const cleared = await fetch(`http://${HOST}:${inspectorPort}/api/clear`, { method: "DELETE" });
    expect(cleared.status).toBe(204);
    expect(await entries()).toEqual([]);
  });
});
