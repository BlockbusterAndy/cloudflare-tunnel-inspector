import type { InspectorRequest, ReplayPayload } from "../../../hooks/useInspectorFeed";

export const METHOD_COLORS: Record<string, { text: string; border: string; label: string }> = {
  GET: { text: "text-[#4fdbc8]", border: "border-[#4fdbc8]/20", label: "GET" },
  POST: { text: "text-[#f59e0b]", border: "border-[#f59e0b]/20", label: "POST" },
  PUT: { text: "text-[#60a5fa]", border: "border-[#60a5fa]/20", label: "PUT" },
  DELETE: { text: "text-[#ffb4ab]", border: "border-[#ffb4ab]/20", label: "DEL" },
  PATCH: { text: "text-[#c084fc]", border: "border-[#c084fc]/20", label: "PATCH" },
  HEAD: { text: "text-[#908fa0]", border: "border-[#464554]/40", label: "HEAD" },
  OPTIONS: { text: "text-[#908fa0]", border: "border-[#464554]/40", label: "OPT" },
};

export function getMethodStyle(m: string) {
  return METHOD_COLORS[m] ?? { text: "text-[#908fa0]", border: "border-[#464554]/20", label: m };
}

export function getStatusStyle(s: number) {
  if (s >= 500) return { text: "text-[#ffb4ab]", bg: "bg-[#ffb4ab]" };
  if (s >= 400) return { text: "text-[#f59e0b]", bg: "bg-[#f59e0b]" };
  if (s >= 300) return { text: "text-[#60a5fa]", bg: "bg-[#60a5fa]" };
  return { text: "text-[#4fdbc8]", bg: "bg-[#4fdbc8]" };
}

export function getStatusText(s: number) {
  const map: Record<number, string> = {
    101: "Switching Protocols",
    200: "OK", 201: "Created", 204: "No Content", 301: "Moved", 304: "Not Modified",
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
    500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable",
  };
  return map[s] ?? "";
}

export function formatBytes(bytes: number | undefined | null) {
  if (bytes === undefined || bytes === null) return "";
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Filtering ──────────────────────────────────────────────────────────

export const METHOD_FILTERS = ["All", "GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type MethodFilter = (typeof METHOD_FILTERS)[number];

export const STATUS_FILTERS = ["All", "2xx", "3xx", "4xx", "5xx"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export function matchesStatusFilter(status: number, filter: StatusFilter) {
  if (filter === "All") return true;
  const bucket = Math.floor(status / 100);
  return `${bucket}xx` === filter;
}

export function matchesSearch(req: InspectorRequest, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    req.method.toLowerCase().includes(q) ||
    req.url.toLowerCase().includes(q) ||
    String(req.status).includes(q)
  );
}

// ── URL display ────────────────────────────────────────────────────────

/**
 * `req.url` from Node is an origin-form path ("/a/b?c=1"), but absolute-form
 * ("http://host/a/b") is legal too. Handle both and keep the query separate so
 * the list can dim it.
 */
export function splitUrl(url: string): { path: string; query: string } {
  const withoutHash = url.split("#")[0];
  const target = /^https?:\/\//i.test(withoutHash)
    ? withoutHash.replace(/^https?:\/\/[^/]*/i, "") || "/"
    : withoutHash;
  const index = target.indexOf("?");
  if (index === -1) return { path: target, query: "" };
  return { path: target.slice(0, index), query: target.slice(index) };
}

// ── Redaction ──────────────────────────────────────────────────────────

export const REDACTED_VALUE = "«redacted»";

export function isRedacted(value: unknown) {
  return value === REDACTED_VALUE;
}

// ── Replay & cURL ──────────────────────────────────────────────────────

/** Headers the proxy or fetch layer must recompute rather than replay verbatim. */
const NON_REPLAYABLE_HEADERS = new Set([
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "upgrade",
  "host",
]);

export function bodyToText(body: unknown): string {
  if (body === null || body === undefined) return "";
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

export function toReplayPayload(req: InspectorRequest): ReplayPayload {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.reqHeaders)) {
    if (NON_REPLAYABLE_HEADERS.has(key.toLowerCase())) continue;
    // A redacted value is a placeholder, not a credential — sending it would
    // just make the replay fail authentication in a confusing way.
    if (isRedacted(value)) continue;
    headers[key] = String(value);
  }
  return {
    method: req.method,
    url: req.url,
    headers,
    body: req.reqBodyBinary ? null : req.reqBody,
  };
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Render a captured request as a runnable cURL command aimed at the proxy,
 * so replaying from a terminal is captured too.
 */
export function toCurl(req: InspectorRequest, proxyOrigin = "http://localhost:8080") {
  const { path, query } = splitUrl(req.url);
  const parts = [`curl -X ${req.method} ${shellQuote(`${proxyOrigin}${path}${query}`)}`];
  const omitted: string[] = [];

  for (const [key, value] of Object.entries(req.reqHeaders)) {
    const lower = key.toLowerCase();
    if (lower === "content-length" || lower === "host" || lower === "connection") continue;
    // Emitting the placeholder would produce a command that silently fails auth.
    if (isRedacted(value)) {
      omitted.push(key);
      continue;
    }
    parts.push(`  -H ${shellQuote(`${key}: ${value}`)}`);
  }

  if (req.reqBodyBinary) {
    parts.push(`  --data-binary '<${formatBytes(req.reqBodySize)} binary body omitted>'`);
  } else {
    const body = bodyToText(req.reqBody);
    if (body) parts.push(`  --data-raw ${shellQuote(body)}`);
  }

  const command = parts.join(" \\\n");
  return omitted.length > 0
    ? `# redacted headers omitted: ${omitted.join(", ")}\n${command}`
    : command;
}

// ── Content-type detection ─────────────────────────────────────────────

export type BodyFormat = "json" | "graphql-json" | "html" | "xml" | "javascript" | "graphql" | "form-data" | "multipart" | "text";

export function isGraphqlJson(body: unknown): boolean {
  if (typeof body === "object" && body !== null && "query" in body) {
    const q = (body as Record<string, unknown>).query;
    return typeof q === "string" && /^\s*(query|mutation|subscription|fragment|\{)/.test(q);
  }
  return false;
}

export function detectFormat(body: unknown, contentType?: string): BodyFormat {
  if (typeof body === "object" && body !== null) {
    if (isGraphqlJson(body)) return "graphql-json";
    return "json";
  }

  const ct = contentType?.toLowerCase() ?? "";
  if (ct.includes("application/json")) {
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body);
        if (isGraphqlJson(parsed)) return "graphql-json";
      } catch { /* not json */ }
    }
    return "json";
  }
  if (ct.includes("text/html")) return "html";
  if (ct.includes("application/xml") || ct.includes("text/xml")) return "xml";
  if (ct.includes("javascript") || ct.includes("ecmascript")) return "javascript";
  if (ct.includes("graphql")) return "graphql";
  if (ct.includes("application/x-www-form-urlencoded")) return "form-data";
  if (ct.includes("multipart/form-data")) return "multipart";

  if (typeof body === "string") {
    const trimmed = body.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (isGraphqlJson(parsed)) return "graphql-json";
        return "json";
      } catch { /* not json */ }
    }
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) return "html";
    if (trimmed.startsWith("<?xml") || /^<[a-zA-Z][\s\S]*>/.test(trimmed)) return "xml";
    if (/^(query|mutation|subscription|fragment)\s/m.test(trimmed)) return "graphql";
    if (/^[a-zA-Z0-9_.~-]+=[^&]*(&[a-zA-Z0-9_.~-]+=[^&]*)*$/.test(trimmed)) return "form-data";
    if (/^--[\w-]+\r?\n/.test(trimmed)) return "multipart";
  }

  return "text";
}

export const FORMAT_LABELS: Record<BodyFormat, string> = {
  json: "JSON", "graphql-json": "GraphQL", html: "HTML", xml: "XML",
  javascript: "JavaScript", graphql: "GraphQL", "form-data": "Form Data",
  multipart: "Multipart", text: "Plain Text",
};

export function getRawText(body: unknown): string {
  if (body === null || body === undefined) return "";
  if (typeof body === "string") return body;
  return JSON.stringify(body, null, 2);
}

export function tryParseJson(text: string): unknown | null {
  try { return JSON.parse(text); } catch { return null; }
}
