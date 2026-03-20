"use client";

import { useState, useMemo, useCallback } from "react";
import {
  useInspectorFeed,
  type InspectorRequest,
} from "../../hooks/useInspectorFeed";

// ── Helpers ────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, { text: string; border: string; label: string }> = {
  GET: { text: "text-[#4fdbc8]", border: "border-[#4fdbc8]/20", label: "GET" },
  POST: { text: "text-[#f59e0b]", border: "border-[#f59e0b]/20", label: "POST" },
  PUT: { text: "text-[#60a5fa]", border: "border-[#60a5fa]/20", label: "PUT" },
  DELETE: { text: "text-[#ffb4ab]", border: "border-[#ffb4ab]/20", label: "DEL" },
  PATCH: { text: "text-[#c084fc]", border: "border-[#c084fc]/20", label: "PATCH" },
};

function getMethodStyle(m: string) {
  return METHOD_COLORS[m] ?? { text: "text-[#908fa0]", border: "border-[#464554]/20", label: m };
}

function getStatusStyle(s: number) {
  if (s >= 500) return { text: "text-[#ffb4ab]", bg: "bg-[#ffb4ab]" };
  if (s >= 400) return { text: "text-[#f59e0b]", bg: "bg-[#f59e0b]" };
  if (s >= 300) return { text: "text-[#60a5fa]", bg: "bg-[#60a5fa]" };
  return { text: "text-[#4fdbc8]", bg: "bg-[#4fdbc8]" };
}

function getStatusText(s: number) {
  const map: Record<number, string> = {
    200: "OK", 201: "Created", 204: "No Content", 301: "Moved", 304: "Not Modified",
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
    500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable",
  };
  return map[s] ?? "";
}

function formatBytes(bytes: number | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

type MethodFilter = "All" | "GET" | "POST" | "PUT" | "DELETE";

// ── Content-type detection ─────────────────────────────────────────────

type BodyFormat = "json" | "graphql-json" | "html" | "xml" | "javascript" | "graphql" | "form-data" | "multipart" | "text";

function isGraphqlJson(body: unknown): boolean {
  if (typeof body === "object" && body !== null && "query" in body) {
    const q = (body as Record<string, unknown>).query;
    return typeof q === "string" && /^\s*(query|mutation|subscription|fragment|\{)/.test(q);
  }
  return false;
}

function detectFormat(body: unknown, contentType?: string): BodyFormat {
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

const FORMAT_LABELS: Record<BodyFormat, string> = {
  json: "JSON", "graphql-json": "GraphQL", html: "HTML", xml: "XML",
  javascript: "JavaScript", graphql: "GraphQL", "form-data": "Form Data",
  multipart: "Multipart", text: "Plain Text",
};

// ── Copy button ───────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-mono text-[#908fa0] hover:text-[#c7c4d7] hover:bg-[#39393b] transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 text-[#4fdbc8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-[#4fdbc8]">Copied</span>
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

// ── CodeBlock wrapper ─────────────────────────────────────────────────

function CodeBlock({ children, rawText, label, size }: { children: React.ReactNode; rawText: string; label: string; size?: string }) {
  return (
    <div className="relative group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {label && <span className="text-[10px] font-mono text-[#908fa0]">{label}</span>}
          {size && <span className="text-[10px] font-mono text-[#908fa0]/60">{size}</span>}
        </div>
        <CopyButton text={rawText} />
      </div>
      <pre className="font-mono text-sm text-[#c7c4d7] whitespace-pre overflow-auto rounded-sm bg-[#0e0e10] p-4">
        {children}
      </pre>
    </div>
  );
}

// ── HTML / XML syntax highlighter ─────────────────────────────────────

function MarkupHighlighter({ text }: { text: string }) {
  const tokens: React.ReactNode[] = [];
  const re = /(<!--[\s\S]*?-->)|(<\/?\s*)([\w:.-]+)((?:\s+[\w:.-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?)*)\s*(\/?>)|([^<]+)/g;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = re.exec(text)) !== null) {
    if (match[1]) {
      tokens.push(<span key={i++} className="text-[#908fa0]/60 italic">{match[1]}</span>);
    } else if (match[2]) {
      tokens.push(<span key={i++} className="text-[#908fa0]">{match[2]}</span>);
      tokens.push(<span key={i++} className="text-[#ffb4ab]">{match[3]}</span>);
      if (match[4]) {
        const attrRe = /([\w:.-]+)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s>]*)?/g;
        let attrMatch: RegExpExecArray | null;
        const attrStr = match[4];
        while ((attrMatch = attrRe.exec(attrStr)) !== null) {
          if (!attrMatch[0].trim()) continue;
          tokens.push(<span key={i++} className="text-[#f59e0b]">{" "}{attrMatch[1]}</span>);
          if (attrMatch[2]) {
            tokens.push(<span key={i++} className="text-[#908fa0]">{attrMatch[2]}</span>);
            if (attrMatch[3]) {
              tokens.push(<span key={i++} className="text-[#4fdbc8]">{attrMatch[3]}</span>);
            }
          }
        }
      }
      tokens.push(<span key={i++} className="text-[#908fa0]">{match[5]}</span>);
    } else if (match[6]) {
      tokens.push(<span key={i++}>{match[6]}</span>);
    }
  }

  return <>{tokens}</>;
}

// ── JavaScript syntax highlighter ─────────────────────────────────────

const JS_KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "do", "switch", "case", "break", "continue", "new", "delete", "typeof",
  "instanceof", "in", "of", "class", "extends", "import", "export", "from",
  "default", "try", "catch", "finally", "throw", "async", "await", "yield",
  "this", "super", "null", "undefined", "true", "false", "void", "with",
]);

function JsHighlighter({ text }: { text: string }) {
  const tokens: React.ReactNode[] = [];
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\b[a-zA-Z_$][\w$]*\b)|(=>|[{}()[\];,.:?!&|<>=+\-*/%~^]+)/g;
  let match: RegExpExecArray | null;
  let i = 0;
  let lastIndex = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(<span key={i++}>{text.slice(lastIndex, match.index)}</span>);
    }
    if (match[1]) tokens.push(<span key={i++} className="text-[#908fa0]/60 italic">{match[1]}</span>);
    else if (match[2]) tokens.push(<span key={i++} className="text-[#4fdbc8]">{match[2]}</span>);
    else if (match[3]) tokens.push(<span key={i++} className="text-[#4fdbc8]">{match[3]}</span>);
    else if (match[4]) {
      const cls = JS_KEYWORDS.has(match[4])
        ? "text-[#c084fc] font-semibold"
        : /^[A-Z]/.test(match[4]) ? "text-[#f59e0b]" : "text-[#60a5fa]";
      tokens.push(<span key={i++} className={cls}>{match[4]}</span>);
    } else if (match[5]) tokens.push(<span key={i++} className="text-[#908fa0]">{match[5]}</span>);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) tokens.push(<span key={i++}>{text.slice(lastIndex)}</span>);
  return <>{tokens}</>;
}

// ── Form-data viewer ──────────────────────────────────────────────────

function FormDataViewer({ text }: { text: string }) {
  const params = text.split("&").map((pair) => {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) return { key: decodeURIComponent(pair), value: "" };
    return {
      key: decodeURIComponent(pair.slice(0, eqIdx)),
      value: decodeURIComponent(pair.slice(eqIdx + 1)),
    };
  });

  return (
    <div className="space-y-0">
      {params.map(({ key, value }, i) => (
        <div key={i} className="flex gap-4 py-1.5">
          <span className="font-mono text-sm text-[#c084fc] shrink-0">{key}</span>
          <span className="font-mono text-sm text-[#4fdbc8] break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Multipart form-data viewer ────────────────────────────────────────

interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  value: string;
}

function parseMultipart(text: string): MultipartPart[] {
  const lines = text.split(/\r?\n/);
  const boundary = lines[0]?.trim();
  if (!boundary || !boundary.startsWith("--")) return [];

  const parts: MultipartPart[] = [];
  const rawParts = text.split(boundary).slice(1);

  for (const raw of rawParts) {
    if (raw.trim() === "--" || raw.trim() === "") continue;
    const headerEnd = raw.indexOf("\r\n\r\n") !== -1
      ? raw.indexOf("\r\n\r\n") : raw.indexOf("\n\n");
    const sep = raw.indexOf("\r\n\r\n") !== -1 ? "\r\n\r\n" : "\n\n";
    if (headerEnd === -1) continue;

    const headerSection = raw.slice(0, headerEnd);
    const body = raw.slice(headerEnd + sep.length).replace(/\r?\n$/, "");

    parts.push({
      name: headerSection.match(/name="([^"]+)"/)?.[1] ?? "(unknown)",
      filename: headerSection.match(/filename="([^"]+)"/)?.[1],
      contentType: headerSection.match(/Content-Type:\s*(.+)/i)?.[1]?.trim(),
      value: body,
    });
  }
  return parts;
}

function MultipartViewer({ text }: { text: string }) {
  const parts = parseMultipart(text);

  if (parts.length === 0) {
    return (
      <pre className="font-mono text-sm text-[#c7c4d7] whitespace-pre-wrap overflow-auto rounded-sm bg-[#0e0e10] p-3">
        {text}
      </pre>
    );
  }

  return (
    <div className="space-y-0">
      {parts.map((part, i) => (
        <div key={i} className="flex gap-4 py-1.5">
          <div className="shrink-0">
            <span className="font-mono text-sm text-[#c084fc]">{part.name}</span>
            {part.filename && <span className="text-[#908fa0] text-xs ml-2">({part.filename})</span>}
            {part.contentType && <span className="text-[#908fa0] text-xs block">{part.contentType}</span>}
          </div>
          <span className="font-mono text-sm text-[#4fdbc8] break-all">
            {part.value || <span className="text-[#908fa0] italic">(binary)</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── JSON viewer ────────────────────────────────────────────────────────

function JsonValue({ value, indent = 0 }: { value: unknown; indent?: number }) {
  if (value === null || value === undefined)
    return <span className="text-[#908fa0]">null</span>;
  if (typeof value === "boolean")
    return <span className="text-[#c084fc]">{String(value)}</span>;
  if (typeof value === "number")
    return <span className="text-[#4fdbc8]">{value}</span>;
  if (typeof value === "string")
    return <span className="text-[#4fdbc8]">&quot;{value}&quot;</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span>{"[]"}</span>;
    return (
      <span>
        {"[\n"}
        {value.map((item, i) => (
          <span key={i}>
            {"  ".repeat(indent + 1)}
            <JsonValue value={item} indent={indent + 1} />
            {i < value.length - 1 ? "," : ""}
            {"\n"}
          </span>
        ))}
        {"  ".repeat(indent)}
        {"]"}
      </span>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span>{"{}"}</span>;
    return (
      <span>
        {"{\n"}
        {entries.map(([k, v], i) => (
          <span key={k}>
            {"  ".repeat(indent + 1)}
            <span className="text-[#c7c4d7]">&quot;{k}&quot;</span>
            {": "}
            <JsonValue value={v} indent={indent + 1} />
            {i < entries.length - 1 ? "," : ""}
            {"\n"}
          </span>
        ))}
        {"  ".repeat(indent)}
        {"}"}
      </span>
    );
  }

  return <span>{String(value)}</span>;
}

// ── GraphQL syntax highlighter ────────────────────────────────────────

const GQL_KEYWORDS = new Set([
  "query", "mutation", "subscription", "fragment", "on", "type", "input",
  "enum", "scalar", "interface", "union", "extend", "schema", "directive",
  "implements", "true", "false", "null",
]);

function GraphqlHighlighter({ text }: { text: string }) {
  const tokens: React.ReactNode[] = [];
  const re = /(#[^\n]*)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(\$\w+)|(@\w+)|(\b[a-zA-Z_]\w*\b)|([{}()[\]:!=,.|&…]+)/g;
  let match: RegExpExecArray | null;
  let i = 0;
  let lastIndex = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(<span key={i++}>{text.slice(lastIndex, match.index)}</span>);
    }
    if (match[1]) tokens.push(<span key={i++} className="text-[#908fa0]/60 italic">{match[1]}</span>);
    else if (match[2]) tokens.push(<span key={i++} className="text-[#4fdbc8]">{match[2]}</span>);
    else if (match[3]) tokens.push(<span key={i++} className="text-[#4fdbc8]">{match[3]}</span>);
    else if (match[4]) tokens.push(<span key={i++} className="text-[#f59e0b]">{match[4]}</span>);
    else if (match[5]) tokens.push(<span key={i++} className="text-[#c084fc]">{match[5]}</span>);
    else if (match[6]) {
      const cls = GQL_KEYWORDS.has(match[6]) ? "text-[#c084fc] font-semibold"
        : /^[A-Z]/.test(match[6]) ? "text-[#f59e0b]" : "text-[#60a5fa]";
      tokens.push(<span key={i++} className={cls}>{match[6]}</span>);
    } else if (match[7]) tokens.push(<span key={i++} className="text-[#908fa0]">{match[7]}</span>);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) tokens.push(<span key={i++}>{text.slice(lastIndex)}</span>);
  return <>{tokens}</>;
}

// ── GraphQL-over-JSON viewer ──────────────────────────────────────────

function GraphqlJsonViewer({ body }: { body: Record<string, unknown> }) {
  const query = body.query as string;
  const variables = body.variables as Record<string, unknown> | undefined;
  const operationName = body.operationName as string | undefined;

  return (
    <div className="space-y-3">
      {operationName && (
        <div>
          <p className="text-[10px] font-semibold text-[#908fa0] uppercase tracking-[0.05em] mb-1">Operation</p>
          <span className="font-mono text-sm text-[#c084fc]">{operationName}</span>
        </div>
      )}
      <div>
        <p className="text-[10px] font-semibold text-[#908fa0] uppercase tracking-[0.05em] mb-1">Query</p>
        <pre className="font-mono text-sm text-[#c7c4d7] whitespace-pre overflow-auto rounded-sm bg-[#0e0e10] p-3">
          <GraphqlHighlighter text={query} />
        </pre>
      </div>
      {variables && Object.keys(variables).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[#908fa0] uppercase tracking-[0.05em] mb-1">Variables</p>
          <pre className="font-mono text-sm text-[#c7c4d7] whitespace-pre overflow-auto rounded-sm bg-[#0e0e10] p-3">
            <JsonValue value={variables} />
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Body viewer ───────────────────────────────────────────────────────

function getRawText(body: unknown): string {
  if (body === null || body === undefined) return "";
  if (typeof body === "string") return body;
  return JSON.stringify(body, null, 2);
}

function tryParseJson(text: string): unknown | null {
  try { return JSON.parse(text); } catch { return null; }
}

function BodyViewer({ body, contentType, title = "Body" }: { body: unknown; contentType?: string; title?: string }) {
  if (body === null || body === undefined)
    return <p className="text-sm italic text-[#908fa0]">No body</p>;

  const format = detectFormat(body, contentType);
  const label = FORMAT_LABELS[format];
  const rawText = getRawText(body);
  const sizeStr = formatBytes(rawText.length);

  // GraphQL-over-JSON
  if (format === "graphql-json") {
    const obj = typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : tryParseJson(String(body)) as Record<string, unknown> | null;
    if (obj) {
      return (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-[#908fa0] uppercase tracking-[0.05em]">{title}</span>
            <CopyButton text={rawText} />
          </div>
          <GraphqlJsonViewer body={obj} />
        </div>
      );
    }
  }

  // JSON (object already parsed)
  if (format === "json" && typeof body === "object") {
    return (
      <CodeBlock rawText={rawText} label={label} size={sizeStr}>
        <JsonValue value={body} />
      </CodeBlock>
    );
  }

  const text = String(body);

  // JSON (string that needs parsing)
  if (format === "json") {
    const parsed = tryParseJson(text);
    if (parsed !== null) {
      const prettyJson = JSON.stringify(parsed, null, 2);
      return (
        <CodeBlock rawText={prettyJson} label={label} size={sizeStr}>
          <JsonValue value={parsed} />
        </CodeBlock>
      );
    }
  }

  // Form data
  if (format === "form-data") {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono text-[#908fa0]">{label}</span>
          <CopyButton text={text} />
        </div>
        <div className="rounded-sm bg-[#0e0e10] p-4">
          <FormDataViewer text={text} />
        </div>
      </div>
    );
  }

  // Multipart
  if (format === "multipart") {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono text-[#908fa0]">{label}</span>
          <CopyButton text={text} />
        </div>
        <div className="rounded-sm bg-[#0e0e10] p-4">
          <MultipartViewer text={text} />
        </div>
      </div>
    );
  }

  // HTML / XML with syntax highlighting
  if (format === "html" || format === "xml") {
    return (
      <CodeBlock rawText={text} label={label} size={sizeStr}>
        <MarkupHighlighter text={text} />
      </CodeBlock>
    );
  }

  // JavaScript
  if (format === "javascript") {
    return (
      <CodeBlock rawText={text} label={label} size={sizeStr}>
        <JsHighlighter text={text} />
      </CodeBlock>
    );
  }

  // GraphQL
  if (format === "graphql") {
    return (
      <CodeBlock rawText={text} label={label} size={sizeStr}>
        <GraphqlHighlighter text={text} />
      </CodeBlock>
    );
  }

  // Plain text fallback
  return (
    <CodeBlock rawText={text} label={label} size={sizeStr}>
      {text}
    </CodeBlock>
  );
}

// ── Headers table ─────────────────────────────────────────────────────

function HeadersTable({ headers, title }: { headers: Record<string, string>; title: string }) {
  const entries = Object.entries(headers);
  if (entries.length === 0)
    return <p className="text-sm italic text-[#908fa0]">No headers</p>;
  return (
    <div>
      <h3 className="text-[10px] font-semibold text-[#908fa0] uppercase tracking-[0.05em] mb-3">{title}</h3>
      <div className="space-y-0">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between py-1.5 gap-4">
            <span className="font-mono text-sm text-[#c0c1ff] shrink-0">{k}</span>
            <span className="font-mono text-sm text-[#c7c4d7] text-right truncate">{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Metadata grid ─────────────────────────────────────────────────────

function MetadataGrid({ req }: { req: InspectorRequest }) {
  const methodStyle = getMethodStyle(req.method);
  const statusStyle = getStatusStyle(req.status);
  const statusText = getStatusText(req.status);

  return (
    <div>
      <h3 className="text-[10px] font-semibold text-[#908fa0] uppercase tracking-[0.05em] mb-3">Metadata</h3>
      <div className="bg-[#201f22] rounded-sm overflow-hidden">
        {/* Row 1: Method + Status */}
        <div className="grid grid-cols-2">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[#908fa0]">Method</span>
            <span className={`font-mono text-sm font-bold ${methodStyle.text}`}>{req.method}</span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between bg-[#1a1a1c]">
            <span className="text-sm text-[#908fa0]">Status</span>
            <span className={`font-mono text-sm font-bold ${statusStyle.text}`}>
              {req.status} {statusText}
            </span>
          </div>
        </div>
        {/* Row 2: Duration + Time */}
        <div className="grid grid-cols-2" style={{ borderTop: "1px solid rgba(70, 69, 84, 0.15)" }}>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[#908fa0]">Duration</span>
            <span className="font-mono text-sm text-[#c7c4d7]">{req.duration.toFixed(2)} ms</span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between bg-[#1a1a1c]">
            <span className="text-sm text-[#908fa0]">Time</span>
            <span className="font-mono text-sm text-[#c7c4d7]">
              {new Date(req.startedAt).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 })}
            </span>
          </div>
        </div>
        {/* Row 3: URL */}
        <div style={{ borderTop: "1px solid rgba(70, 69, 84, 0.15)" }}>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[#908fa0]">URL</span>
            <span className="font-mono text-sm text-[#c7c4d7] text-right break-all ml-8">{req.url}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────

function DetailPanel({ req }: { req: InspectorRequest }) {
  const [activeTab, setActiveTab] = useState<"overview" | "request" | "response">("overview");

  const tabs = [
    { id: "overview" as const, label: "OVERVIEW" },
    { id: "request" as const, label: "REQUEST" },
    { id: "response" as const, label: "RESPONSE" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-0 bg-[#2a2a2c] shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-xs font-semibold tracking-[0.05em] transition-colors relative ${
              activeTab === tab.id
                ? "text-[#e6e1e5] bg-[#353437]"
                : "text-[#908fa0] hover:text-[#c7c4d7] hover:bg-[#39393b]"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#c0c1ff]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === "overview" && (
          <>
            <MetadataGrid req={req} />

            <div className="grid grid-cols-2 gap-8">
              <HeadersTable headers={req.reqHeaders} title="Request Headers" />
              <HeadersTable headers={req.resHeaders} title="Response Headers" />
            </div>

            <BodyViewer
              body={req.resBody}
              contentType={req.resHeaders["content-type"] ?? req.resHeaders["Content-Type"]}
            />
          </>
        )}

        {activeTab === "request" && (
          <>
            <HeadersTable headers={req.reqHeaders} title="Request Headers" />
            <div className="mt-6">
              <BodyViewer
                body={req.reqBody}
                contentType={req.reqHeaders["content-type"] ?? req.reqHeaders["Content-Type"]}
              />
            </div>
          </>
        )}

        {activeTab === "response" && (
          <>
            <HeadersTable headers={req.resHeaders} title="Response Headers" />
            <div className="mt-6">
              <BodyViewer
                body={req.resBody}
                contentType={req.resHeaders["content-type"] ?? req.resHeaders["Content-Type"]}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────

export default function InspectorPage() {
  const { requests, connected, clear } = useInspectorFeed();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("All");

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (methodFilter !== "All" && r.method !== methodFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.method.toLowerCase().includes(q) && !r.url.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [requests, methodFilter, search]);

  const selected = useMemo(
    () => requests.find((r) => r.id === selectedId) ?? null,
    [requests, selectedId]
  );

  const methodFilters: MethodFilter[] = ["All", "GET", "POST", "PUT", "DELETE"];

  return (
    <div className="h-screen flex flex-col bg-[#131315] text-[#e6e1e5]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-[#131315] shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-mono font-semibold tracking-tight text-[#e6e1e5]">
            Tunnel Inspector
          </h1>
          {!connected && (
            <span className="inline-flex items-center gap-1.5 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab]" />
              <span className="text-[#ffb4ab]">Disconnected</span>
            </span>
          )}
        </div>
        <button
          onClick={() => { clear(); setSelectedId(null); }}
          className="text-[11px] font-semibold tracking-[0.08em] text-[#908fa0] hover:text-[#c7c4d7] transition-colors uppercase"
        >
          Clear Logs
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left panel - Request list */}
        <div className="w-[380px] shrink-0 flex flex-col bg-[#131315]" style={{ borderRight: "1px solid rgba(70, 69, 84, 0.15)" }}>
          {/* Search */}
          <div className="px-3 py-2.5 shrink-0">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#908fa0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Filter requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#201f22] text-sm text-[#c7c4d7] placeholder-[#908fa0]/60 pl-9 pr-3 py-2 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#c0c1ff]/30"
              />
            </div>
          </div>

          {/* Method filter chips */}
          <div className="flex items-center gap-1 px-3 pb-2 shrink-0">
            {methodFilters.map((m) => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-colors ${
                  methodFilter === m
                    ? "bg-[#2a2a2c] text-[#e6e1e5]"
                    : "text-[#908fa0] hover:text-[#c7c4d7] hover:bg-[#201f22]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Request list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="text-[#908fa0]/20 text-4xl mb-3 font-mono">~</div>
                <p className="text-sm text-[#908fa0]">No requests captured</p>
                <p className="text-[11px] text-[#908fa0]/50 mt-1">
                  Send traffic through the proxy to see it here
                </p>
              </div>
            ) : (
              filtered.map((r) => {
                const methodStyle = getMethodStyle(r.method);
                const statusStyle = getStatusStyle(r.status);
                const isSelected = selectedId === r.id;

                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors animate-fade-in ${
                      isSelected
                        ? "bg-[#201f22]"
                        : "hover:bg-[#39393b]"
                    }`}
                    style={isSelected ? { borderLeft: "2px solid #c0c1ff" } : { borderLeft: "2px solid transparent" }}
                  >
                    {/* Method badge - ghost border style */}
                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider font-mono border rounded-sm px-1.5 py-0.5 ${methodStyle.text} ${methodStyle.border}`}>
                      {methodStyle.label}
                    </span>

                    {/* URL path */}
                    <span className="flex-1 font-mono text-xs text-[#c7c4d7] truncate">
                      {(() => {
                        try { return new URL(r.url).pathname; } catch { return r.url; }
                      })()}
                    </span>

                    {/* Status */}
                    <span className={`shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-sm ${statusStyle.text} bg-current/10`}>
                      {r.status}
                    </span>

                    {/* Duration */}
                    <span className="shrink-0 text-[10px] text-[#908fa0] font-mono w-10 text-right">
                      {r.duration}ms
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel - Detail */}
        <div className="flex-1 min-w-0 bg-[#201f22]">
          {selected ? (
            <DetailPanel req={selected} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-[#908fa0]/15 text-6xl mb-4 font-mono">{"{ }"}</div>
              <p className="text-sm text-[#908fa0]">Select a request to inspect</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
