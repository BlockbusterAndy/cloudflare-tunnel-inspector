/**
 * MCP server exposing captured tunnel traffic to AI agents.
 *
 * It is a thin client of the inspector's HTTP API rather than part of the
 * proxy process, so the proxy stays dependency-free and either side can be
 * restarted independently.
 *
 *   npm run mcp                        # talks to http://127.0.0.1:4040
 *   npm run mcp -- --inspector-url http://127.0.0.1:5050
 *
 * stdio transport: stdout carries the protocol, so every log goes to stderr.
 */

import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const VERSION = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8")
).version;

const DEFAULT_INSPECTOR_URL = "http://127.0.0.1:4040";

/** Bodies are clipped before reaching the model; full ones live in the UI. */
const MAX_BODY_CHARS = 4000;
const DEFAULT_LIMIT = 20;

function resolveInspectorUrl(argv = process.argv.slice(2), env = process.env) {
  const index = argv.indexOf("--inspector-url");
  if (index !== -1 && argv[index + 1]) return argv[index + 1].replace(/\/$/, "");
  const inline = argv.find((a) => a.startsWith("--inspector-url="));
  if (inline) return inline.slice("--inspector-url=".length).replace(/\/$/, "");
  return (env.INSPECTOR_URL ?? DEFAULT_INSPECTOR_URL).replace(/\/$/, "");
}

const INSPECTOR_URL = resolveInspectorUrl();

// ── Inspector API access ───────────────────────────────────────────────

class InspectorUnavailable extends Error {}

async function inspectorFetch(path, init) {
  let res;
  try {
    res = await fetch(`${INSPECTOR_URL}${path}`, init);
  } catch (err) {
    throw new InspectorUnavailable(
      `Cannot reach the inspector at ${INSPECTOR_URL} (${err.message}). ` +
        "Start it with `npm run inspector`, or point this server elsewhere with --inspector-url."
    );
  }
  if (!res.ok) {
    throw new Error(`Inspector returned ${res.status} for ${path}`);
  }
  return res;
}

async function fetchRequests() {
  return (await inspectorFetch("/api/requests")).json();
}

async function fetchConfig() {
  return (await inspectorFetch("/api/config")).json();
}

// ── Shaping entries for a model ────────────────────────────────────────

function clip(value) {
  if (value === null || value === undefined) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (text.length <= MAX_BODY_CHARS) return text;
  return `${text.slice(0, MAX_BODY_CHARS)}\n… truncated, ${text.length - MAX_BODY_CHARS} more characters`;
}

function describeBody(body, size, truncated, binary) {
  if (binary) return `<binary, ${size} bytes, not captured>`;
  if (body === null || body === undefined) return null;
  const text = clip(body);
  return truncated ? `${text}\n<capture truncated at the proxy's --max-body-bytes>` : text;
}

/** Compact form for lists: enough to choose one, small enough for many. */
function summarize(entry) {
  return {
    id: entry.id,
    method: entry.upgrade ? "WS" : entry.method,
    url: entry.url,
    status: entry.status,
    durationMs: entry.duration,
    ttfbMs: entry.ttfb,
    requestBytes: entry.reqBodySize,
    responseBytes: entry.resBodySize,
    at: entry.startedAt,
    ...(entry.replayed ? { replayed: true } : {}),
    ...(entry.upgrade ? { upgrade: true } : {}),
    ...(entry.error ? { error: entry.error } : {}),
  };
}

function detail(entry) {
  return {
    ...summarize(entry),
    requestHeaders: entry.reqHeaders,
    requestBody: describeBody(
      entry.reqBody,
      entry.reqBodySize,
      entry.reqBodyTruncated,
      entry.reqBodyBinary
    ),
    responseHeaders: entry.resHeaders,
    responseBody: describeBody(
      entry.resBody,
      entry.resBodySize,
      entry.resBodyTruncated,
      entry.resBodyBinary
    ),
  };
}

function matchesStatus(entry, filter) {
  if (!filter) return true;
  if (/^\d{3}$/.test(filter)) return entry.status === Number(filter);
  const match = /^([1-5])xx$/i.exec(filter);
  if (match) return Math.floor(entry.status / 100) === Number(match[1]);
  return true;
}

function matchesSearch(entry, search) {
  if (!search) return true;
  const q = search.toLowerCase();
  return (
    entry.url?.toLowerCase().includes(q) ||
    entry.method?.toLowerCase().includes(q) ||
    String(entry.status).includes(q)
  );
}

// ── Tool result helpers ────────────────────────────────────────────────

function json(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function failure(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Turns an unreachable proxy into advice rather than a stack trace. */
function guard(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof InspectorUnavailable) return failure(err.message);
      return failure(`Inspector request failed: ${err.message}`);
    }
  };
}

// ── Server ─────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "tunnel-inspector",
  version: VERSION,
});

server.registerTool(
  "list_requests",
  {
    title: "List captured requests",
    description:
      "List HTTP requests captured by the Cloudflare Tunnel inspector proxy, newest first. " +
      "Returns compact summaries without bodies — call get_request for the full entry. " +
      "Filter by method, status (exact like '404' or a class like '5xx'), or a substring of the URL.",
    inputSchema: {
      method: z.string().optional().describe("HTTP method, e.g. GET or POST"),
      status: z.string().optional().describe("Exact status ('404') or class ('4xx')"),
      search: z.string().optional().describe("Substring matched against the URL, method, or status"),
      limit: z.number().int().min(1).max(200).optional().describe(`Max entries (default ${DEFAULT_LIMIT})`),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  guard(async ({ method, status, search, limit }) => {
    const entries = await fetchRequests();
    const filtered = entries
      .filter((e) => !method || e.method?.toUpperCase() === method.toUpperCase())
      .filter((e) => matchesStatus(e, status))
      .filter((e) => matchesSearch(e, search));

    const capped = filtered.slice(0, limit ?? DEFAULT_LIMIT);
    return json({
      total: entries.length,
      matched: filtered.length,
      returned: capped.length,
      requests: capped.map(summarize),
    });
  })
);

server.registerTool(
  "get_request",
  {
    title: "Get one captured request",
    description:
      "Full detail for a single captured request: headers and bodies for both sides. " +
      "Bodies are clipped for context; binary and truncated bodies are labelled. " +
      "Headers hidden by the proxy's --redact flag appear as «redacted».",
    inputSchema: {
      id: z.string().describe("Entry id from list_requests"),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  guard(async ({ id }) => {
    const entries = await fetchRequests();
    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      return failure(`No captured request with id ${id}. It may have aged out of the buffer.`);
    }
    return json(detail(entry));
  })
);

server.registerTool(
  "get_stats",
  {
    title: "Summarise captured traffic",
    description:
      "Aggregate view of the capture buffer: counts by method and status class, error and " +
      "replay counts, timing percentiles, and the slowest requests. Use this before listing " +
      "when you want to know what is going wrong rather than read individual entries.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  guard(async () => {
    const entries = await fetchRequests();
    if (entries.length === 0) {
      return json({ total: 0, note: "No traffic captured yet. Send requests through the proxy port." });
    }

    const byMethod = {};
    const byStatusClass = {};
    let errors = 0;
    let replays = 0;
    let upgrades = 0;

    for (const entry of entries) {
      const method = entry.upgrade ? "WS" : entry.method;
      byMethod[method] = (byMethod[method] ?? 0) + 1;
      const bucket = `${Math.floor(entry.status / 100)}xx`;
      byStatusClass[bucket] = (byStatusClass[bucket] ?? 0) + 1;
      if (entry.error || entry.status >= 500) errors += 1;
      if (entry.replayed) replays += 1;
      if (entry.upgrade) upgrades += 1;
    }

    const durations = entries.map((e) => e.duration).sort((a, b) => a - b);
    const percentile = (p) => durations[Math.min(durations.length - 1, Math.floor((p / 100) * durations.length))];

    const slowest = [...entries]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .map((e) => ({ id: e.id, method: e.method, url: e.url, status: e.status, durationMs: e.duration }));

    return json({
      total: entries.length,
      oldest: entries[entries.length - 1]?.startedAt,
      newest: entries[0]?.startedAt,
      byMethod,
      byStatusClass,
      errors,
      replays,
      upgrades,
      durationMs: { p50: percentile(50), p95: percentile(95), max: durations[durations.length - 1] },
      slowest,
    });
  })
);

server.registerTool(
  "replay_request",
  {
    title: "Replay a captured request",
    description:
      "Re-send a captured request through the proxy to your local app. The replay is captured " +
      "like organic traffic and appears as a new entry marked replayed, so you can compare before " +
      "and after a fix. Redacted headers are omitted, so authenticated requests may replay as 401.",
    inputSchema: {
      id: z.string().describe("Entry id from list_requests"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  guard(async ({ id }) => {
    const entries = await fetchRequests();
    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      return failure(`No captured request with id ${id}. It may have aged out of the buffer.`);
    }
    if (entry.upgrade) {
      return failure("WebSocket upgrades cannot be replayed.");
    }

    const headers = {};
    for (const [key, value] of Object.entries(entry.reqHeaders ?? {})) {
      const lower = key.toLowerCase();
      if (["content-length", "transfer-encoding", "connection", "host"].includes(lower)) continue;
      if (value === "«redacted»") continue;
      headers[key] = value;
    }

    const res = await inspectorFetch("/api/replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: entry.method,
        url: entry.url,
        headers,
        body: entry.reqBodyBinary ? null : entry.reqBody,
      }),
    });

    const result = await res.json();
    return json({
      replayed: { method: entry.method, url: entry.url },
      status: result.status,
      note: "A new entry now exists in the buffer; call list_requests to inspect it.",
    });
  })
);

server.registerTool(
  "clear_requests",
  {
    title: "Clear the capture buffer",
    description:
      "Discard every captured request. Useful before reproducing an issue so the buffer holds " +
      "only the relevant traffic. This cannot be undone.",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  guard(async () => {
    await inspectorFetch("/api/clear", { method: "DELETE" });
    return json({ cleared: true });
  })
);

server.registerResource(
  "inspector-config",
  "inspector://config",
  {
    title: "Inspector configuration",
    description: "Ports, capture limits, and redaction state of the running proxy.",
    mimeType: "application/json",
  },
  async (uri) => {
    const config = await fetchConfig();
    return {
      contents: [
        { uri: uri.href, mimeType: "application/json", text: JSON.stringify(config, null, 2) },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

// stdout belongs to the protocol.
console.error(`tunnel-inspector MCP server v${VERSION} → ${INSPECTOR_URL}`);
