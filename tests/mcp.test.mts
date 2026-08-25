import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import net from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const HOST = "127.0.0.1";
const SERVER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server");
const PROXY_SCRIPT = path.join(SERVER_DIR, "proxy.mjs");
const MCP_SCRIPT = path.join(SERVER_DIR, "mcp.mjs");

let upstream: http.Server;
const upstreamSockets = new Set<net.Socket>();
let proxy: ChildProcess;
let client: Client;
let transport: StdioClientTransport;
let proxyPort = 0;
let inspectorPort = 0;

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

/** Reads a tool result's single text block. */
function textOf(result: unknown): string {
  const content = (result as { content: Array<{ type: string; text?: string }> }).content;
  return content.map((c) => c.text ?? "").join("");
}

function jsonOf<T>(result: unknown): T {
  return JSON.parse(textOf(result)) as T;
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args });
}

beforeAll(async () => {
  upstream = await new Promise<http.Server>((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/boom") {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "kaboom" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, path: req.url }));
    });
    server.on("connection", (socket) => {
      upstreamSockets.add(socket);
      socket.on("close", () => upstreamSockets.delete(socket));
    });
    server.listen(0, HOST, () => resolve(server));
  });

  const targetPort = (upstream.address() as net.AddressInfo).port;
  proxyPort = await freePort();
  inspectorPort = await freePort();

  proxy = spawn(
    process.execPath,
    [
      PROXY_SCRIPT,
      "--target-port", String(targetPort),
      "--proxy-port", String(proxyPort),
      "--inspector-port", String(inspectorPort),
      "--redact", "authorization",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  proxy.stderr?.on("data", (d) => console.error(`[proxy] ${d}`));

  const deadline = Date.now() + 15_000;
  for (;;) {
    try {
      if ((await fetch(`http://${HOST}:${inspectorPort}/api/config`)).ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) throw new Error("proxy did not start");
    await new Promise((r) => setTimeout(r, 100));
  }

  // Seed the buffer with traffic the MCP tools can report on.
  await fetch(`http://${HOST}:${proxyPort}/api/users`, {
    headers: { Authorization: "Bearer secret-token" },
  });
  await fetch(`http://${HOST}:${proxyPort}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item: "widget" }),
  });
  await fetch(`http://${HOST}:${proxyPort}/boom`);

  transport = new StdioClientTransport({
    command: process.execPath,
    args: [MCP_SCRIPT, "--inspector-url", `http://${HOST}:${inspectorPort}`],
  });
  client = new Client({ name: "test-agent", version: "1.0.0" });
  await client.connect(transport);
}, 40_000);

afterAll(async () => {
  await client?.close().catch(() => {});
  proxy?.kill();
  for (const socket of upstreamSockets) socket.destroy();
  upstreamSockets.clear();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

describe("mcp server", () => {
  it("advertises its tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "clear_requests",
      "get_request",
      "get_stats",
      "list_requests",
      "replay_request",
    ]);

    const list = tools.find((t) => t.name === "list_requests");
    expect(list?.description).toBeTruthy();
    expect(list?.annotations?.readOnlyHint).toBe(true);

    const replay = tools.find((t) => t.name === "replay_request");
    expect(replay?.annotations?.readOnlyHint).toBe(false);

    const clear = tools.find((t) => t.name === "clear_requests");
    expect(clear?.annotations?.destructiveHint).toBe(true);
  });

  it("lists captured requests newest first, without bodies", async () => {
    const result = jsonOf<{ total: number; returned: number; requests: Array<Record<string, unknown>> }>(
      await callTool("list_requests")
    );
    expect(result.total).toBe(3);
    expect(result.requests[0].url).toBe("/boom");
    expect(result.requests[0]).not.toHaveProperty("responseBody");
    expect(result.requests[0]).toHaveProperty("durationMs");
  });

  it("filters by method, status class and search", async () => {
    const posts = jsonOf<{ matched: number }>(await callTool("list_requests", { method: "POST" }));
    expect(posts.matched).toBe(1);

    const failures = jsonOf<{ matched: number; requests: Array<{ url: string }> }>(
      await callTool("list_requests", { status: "5xx" })
    );
    expect(failures.matched).toBe(1);
    expect(failures.requests[0].url).toBe("/boom");

    const exact = jsonOf<{ matched: number }>(await callTool("list_requests", { status: "500" }));
    expect(exact.matched).toBe(1);

    const searched = jsonOf<{ matched: number }>(await callTool("list_requests", { search: "orders" }));
    expect(searched.matched).toBe(1);
  });

  it("honours the limit", async () => {
    const limited = jsonOf<{ returned: number; matched: number }>(
      await callTool("list_requests", { limit: 1 })
    );
    expect(limited.returned).toBe(1);
    expect(limited.matched).toBe(3);
  });

  it("returns full detail for one request, with redaction preserved", async () => {
    const list = jsonOf<{ requests: Array<{ id: string; url: string }> }>(
      await callTool("list_requests", { search: "users" })
    );
    const detail = jsonOf<{
      url: string;
      requestHeaders: Record<string, string>;
      responseBody: string;
    }>(await callTool("get_request", { id: list.requests[0].id }));

    expect(detail.url).toBe("/api/users");
    expect(detail.requestHeaders.authorization).toBe("«redacted»");
    expect(JSON.stringify(detail)).not.toContain("secret-token");
    expect(detail.responseBody).toContain("\"ok\": true");
  });

  it("reports a helpful error for an unknown id", async () => {
    const result = await callTool("get_request", { id: "does-not-exist" });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(textOf(result)).toContain("No captured request");
  });

  it("summarises the buffer", async () => {
    const stats = jsonOf<{
      total: number;
      byMethod: Record<string, number>;
      byStatusClass: Record<string, number>;
      errors: number;
      durationMs: { p50: number; max: number };
      slowest: Array<{ url: string }>;
    }>(await callTool("get_stats"));

    expect(stats.total).toBe(3);
    expect(stats.byMethod.GET).toBe(2);
    expect(stats.byMethod.POST).toBe(1);
    expect(stats.byStatusClass["2xx"]).toBe(2);
    expect(stats.byStatusClass["5xx"]).toBe(1);
    expect(stats.errors).toBe(1);
    expect(stats.slowest.length).toBe(3);
    expect(stats.durationMs.max).toBeGreaterThanOrEqual(stats.durationMs.p50);
  });

  it("exposes the proxy configuration as a resource", async () => {
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain("inspector://config");

    const read = await client.readResource({ uri: "inspector://config" });
    const content = read.contents[0];
    expect("text" in content).toBe(true);
    const config = JSON.parse((content as { text: string }).text) as {
      proxyPort: number;
      redacting: boolean;
    };
    expect(config.proxyPort).toBe(proxyPort);
    expect(config.redacting).toBe(true);
  });

  it("replays a request and captures the replay", async () => {
    const list = jsonOf<{ requests: Array<{ id: string }> }>(
      await callTool("list_requests", { search: "orders" })
    );
    const result = jsonOf<{ status: number }>(
      await callTool("replay_request", { id: list.requests[0].id })
    );
    expect(result.status).toBe(200);

    const after = jsonOf<{ total: number; requests: Array<{ replayed?: boolean }> }>(
      await callTool("list_requests")
    );
    expect(after.total).toBe(4);
    expect(after.requests[0].replayed).toBe(true);
  });

  it("clears the buffer", async () => {
    expect(jsonOf<{ cleared: boolean }>(await callTool("clear_requests")).cleared).toBe(true);
    const after = jsonOf<{ total: number }>(await callTool("list_requests"));
    expect(after.total).toBe(0);
  });
});

describe("mcp server without a running inspector", () => {
  it("explains how to start the proxy instead of failing opaquely", async () => {
    const deadPort = await freePort();
    const lonelyTransport = new StdioClientTransport({
      command: process.execPath,
      args: [MCP_SCRIPT, "--inspector-url", `http://${HOST}:${deadPort}`],
    });
    const lonelyClient = new Client({ name: "test-agent", version: "1.0.0" });
    await lonelyClient.connect(lonelyTransport);

    try {
      const result = await lonelyClient.callTool({ name: "list_requests", arguments: {} });
      expect((result as { isError?: boolean }).isError).toBe(true);
      expect(textOf(result)).toContain("npm run inspector");
    } finally {
      await lonelyClient.close();
    }
  }, 20_000);
});
