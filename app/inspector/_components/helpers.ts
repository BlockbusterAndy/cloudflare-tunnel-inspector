export const METHOD_COLORS: Record<string, { text: string; border: string; label: string }> = {
  GET: { text: "text-[#4fdbc8]", border: "border-[#4fdbc8]/20", label: "GET" },
  POST: { text: "text-[#f59e0b]", border: "border-[#f59e0b]/20", label: "POST" },
  PUT: { text: "text-[#60a5fa]", border: "border-[#60a5fa]/20", label: "PUT" },
  DELETE: { text: "text-[#ffb4ab]", border: "border-[#ffb4ab]/20", label: "DEL" },
  PATCH: { text: "text-[#c084fc]", border: "border-[#c084fc]/20", label: "PATCH" },
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
    200: "OK", 201: "Created", 204: "No Content", 301: "Moved", 304: "Not Modified",
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
    500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable",
  };
  return map[s] ?? "";
}

export function formatBytes(bytes: number | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export type MethodFilter = "All" | "GET" | "POST" | "PUT" | "DELETE";

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
