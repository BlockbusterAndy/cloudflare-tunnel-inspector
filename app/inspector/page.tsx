"use client";

import { useState, useMemo } from "react";
import {
  useInspectorFeed,
  type InspectorRequest,
} from "../../hooks/useInspectorFeed";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Helpers ────────────────────────────────────────────────────────────

const METHOD_VARIANTS: Record<string, string> = {
  GET: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  POST: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  PUT: "bg-teal-500/15 text-teal-400 border-teal-500/25",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/25",
  PATCH: "bg-purple-500/15 text-purple-400 border-purple-500/25",
};

function methodBadgeClass(m: string) {
  return METHOD_VARIANTS[m] ?? "bg-muted text-muted-foreground border-border";
}

function statusBadgeClass(s: number) {
  if (s >= 500) return "bg-red-500/15 text-red-400 border-red-500/25";
  if (s >= 400) return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
}

function statusFilterMatch(status: number, filter: string) {
  if (filter === "all") return true;
  if (filter === "2xx") return status >= 200 && status < 300;
  if (filter === "4xx") return status >= 400 && status < 500;
  if (filter === "5xx") return status >= 500;
  return true;
}

// ── Content-type detection ─────────────────────────────────────────────

type BodyFormat = "json" | "html" | "xml" | "javascript" | "graphql" | "form-data" | "text";

function detectFormat(body: unknown, contentType?: string): BodyFormat {
  if (typeof body === "object" && body !== null) return "json";

  const ct = contentType?.toLowerCase() ?? "";
  if (ct.includes("application/json")) return "json";
  if (ct.includes("text/html")) return "html";
  if (ct.includes("application/xml") || ct.includes("text/xml")) return "xml";
  if (ct.includes("javascript") || ct.includes("ecmascript")) return "javascript";
  if (ct.includes("graphql")) return "graphql";
  if (ct.includes("application/x-www-form-urlencoded")) return "form-data";

  // Heuristic detection from string content
  if (typeof body === "string") {
    const trimmed = body.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try { JSON.parse(trimmed); return "json"; } catch { /* not json */ }
    }
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) return "html";
    if (trimmed.startsWith("<?xml") || /^<[a-zA-Z][\s\S]*>/.test(trimmed)) return "xml";
    if (/^(query|mutation|subscription|fragment)\s/m.test(trimmed) || /\{\s*\w+\s*[({]/.test(trimmed)) return "graphql";
    if (/^[a-zA-Z0-9_.~-]+=[^&]*(&[a-zA-Z0-9_.~-]+=[^&]*)*$/.test(trimmed)) return "form-data";
  }

  return "text";
}

const FORMAT_LABELS: Record<BodyFormat, string> = {
  json: "JSON",
  html: "HTML",
  xml: "XML",
  javascript: "JavaScript",
  graphql: "GraphQL",
  "form-data": "Form Data",
  text: "Plain Text",
};

const FORMAT_BADGE_CLASS: Record<BodyFormat, string> = {
  json: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  html: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  xml: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  javascript: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  graphql: "bg-pink-500/15 text-pink-400 border-pink-500/25",
  "form-data": "bg-violet-500/15 text-violet-400 border-violet-500/25",
  text: "bg-muted text-muted-foreground border-border",
};

// ── JSON viewer ────────────────────────────────────────────────────────

function JsonValue({ value, indent = 0 }: { value: unknown; indent?: number }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">null</span>;
  if (typeof value === "boolean")
    return <span className="text-amber-400">{String(value)}</span>;
  if (typeof value === "number")
    return <span className="text-teal-400">{value}</span>;
  if (typeof value === "string")
    return <span className="text-emerald-400">&quot;{value}&quot;</span>;

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
            <span className="text-purple-400">&quot;{k}&quot;</span>
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

// ── HTML / XML syntax highlighter ─────────────────────────────────────

function MarkupHighlighter({ text }: { text: string }) {
  // Tokenize markup into tags, attributes, strings, comments, and text
  const tokens: React.ReactNode[] = [];
  // Regex: comments, tags (with attrs), or text between
  const re = /(<!--[\s\S]*?-->)|(<\/?\s*)([\w:.-]+)((?:\s+[\w:.-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?)*)\s*(\/?>)|([^<]+)/g;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = re.exec(text)) !== null) {
    if (match[1]) {
      // Comment
      tokens.push(<span key={i++} className="text-muted-foreground/60 italic">{match[1]}</span>);
    } else if (match[2]) {
      // Tag
      tokens.push(<span key={i++} className="text-muted-foreground">{match[2]}</span>);
      tokens.push(<span key={i++} className="text-red-400">{match[3]}</span>);
      // Attributes
      if (match[4]) {
        const attrRe = /([\w:.-]+)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s>]*)?/g;
        let attrMatch: RegExpExecArray | null;
        const attrStr = match[4];
        while ((attrMatch = attrRe.exec(attrStr)) !== null) {
          if (!attrMatch[0].trim()) continue;
          tokens.push(<span key={i++} className="text-amber-400">{" "}{attrMatch[1]}</span>);
          if (attrMatch[2]) {
            tokens.push(<span key={i++} className="text-muted-foreground">{attrMatch[2]}</span>);
            if (attrMatch[3]) {
              tokens.push(<span key={i++} className="text-emerald-400">{attrMatch[3]}</span>);
            }
          }
        }
      }
      tokens.push(<span key={i++} className="text-muted-foreground">{match[5]}</span>);
    } else if (match[6]) {
      // Text content
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
  // Match: comments, strings, regex, numbers, keywords/identifiers, operators/punctuation
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\b[a-zA-Z_$][\w$]*\b)|(=>|[{}()[\];,.:?!&|<>=+\-*/%~^]+)/g;
  let match: RegExpExecArray | null;
  let i = 0;
  let lastIndex = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(<span key={i++}>{text.slice(lastIndex, match.index)}</span>);
    }
    if (match[1]) {
      tokens.push(<span key={i++} className="text-muted-foreground/60 italic">{match[1]}</span>);
    } else if (match[2]) {
      tokens.push(<span key={i++} className="text-emerald-400">{match[2]}</span>);
    } else if (match[3]) {
      tokens.push(<span key={i++} className="text-teal-400">{match[3]}</span>);
    } else if (match[4]) {
      const cls = JS_KEYWORDS.has(match[4])
        ? "text-purple-400 font-semibold"
        : /^[A-Z]/.test(match[4])
          ? "text-amber-400"
          : "text-blue-400";
      tokens.push(<span key={i++} className={cls}>{match[4]}</span>);
    } else if (match[5]) {
      tokens.push(<span key={i++} className="text-muted-foreground">{match[5]}</span>);
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push(<span key={i++}>{text.slice(lastIndex)}</span>);
  }

  return <>{tokens}</>;
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
    if (match[1]) {
      tokens.push(<span key={i++} className="text-muted-foreground/60 italic">{match[1]}</span>);
    } else if (match[2]) {
      tokens.push(<span key={i++} className="text-emerald-400">{match[2]}</span>);
    } else if (match[3]) {
      tokens.push(<span key={i++} className="text-teal-400">{match[3]}</span>);
    } else if (match[4]) {
      tokens.push(<span key={i++} className="text-amber-400">{match[4]}</span>);
    } else if (match[5]) {
      tokens.push(<span key={i++} className="text-pink-400">{match[5]}</span>);
    } else if (match[6]) {
      const cls = GQL_KEYWORDS.has(match[6])
        ? "text-purple-400 font-semibold"
        : /^[A-Z]/.test(match[6])
          ? "text-amber-400"
          : "text-blue-400";
      tokens.push(<span key={i++} className={cls}>{match[6]}</span>);
    } else if (match[7]) {
      tokens.push(<span key={i++} className="text-muted-foreground">{match[7]}</span>);
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push(<span key={i++}>{text.slice(lastIndex)}</span>);
  }

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
    <Table>
      <TableBody>
        {params.map(({ key, value }, i) => (
          <TableRow key={i}>
            <TableCell className="py-1.5 pr-4 font-mono text-purple-400 whitespace-nowrap align-top">
              {key}
            </TableCell>
            <TableCell className="py-1.5 font-mono text-emerald-400 break-all whitespace-normal">
              {value}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── HTML preview ──────────────────────────────────────────────────────

function HtmlPreview({ html, baseUrl }: { html: string; baseUrl?: string }) {
  const doc = useMemo(() => {
    // Inject a <base> tag so relative URLs (stylesheets, images) resolve correctly
    if (!baseUrl) return html;
    try {
      const origin = new URL(baseUrl).origin;
      const baseTag = `<base href="${origin}/">`;
      // Insert after <head> if present, otherwise prepend
      if (/<head[\s>]/i.test(html)) {
        return html.replace(/(<head[^>]*>)/i, `$1${baseTag}`);
      }
      return baseTag + html;
    } catch {
      return html;
    }
  }, [html, baseUrl]);

  return (
    <iframe
      srcDoc={doc}
      sandbox="allow-same-origin allow-scripts"
      className="w-full rounded-md border border-border bg-white"
      style={{ minHeight: 300 }}
      title="HTML Preview"
    />
  );
}

// ── Body viewer ───────────────────────────────────────────────────────

function BodyViewer({ body, contentType, baseUrl }: { body: unknown; contentType?: string; baseUrl?: string }) {
  const [preview, setPreview] = useState(false);

  if (body === null || body === undefined)
    return <p className="text-sm italic text-muted-foreground">No body</p>;

  const format = detectFormat(body, contentType);
  const label = FORMAT_LABELS[format];
  const badgeCls = FORMAT_BADGE_CLASS[format];
  const isHtml = format === "html";

  const toolbar = (
    <div className="flex items-center gap-2">
      <Badge className={`text-[10px] ${badgeCls}`}>{label}</Badge>
      {isHtml && (
        <Button
          variant={preview ? "default" : "outline"}
          size="sm"
          className="h-5 text-[10px] px-2"
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? "Source" : "Preview"}
        </Button>
      )}
    </div>
  );

  // For JSON objects, render with JsonValue
  if (format === "json" && typeof body === "object") {
    return (
      <div className="space-y-2">
        {toolbar}
        <pre className="font-mono text-sm text-foreground/80 whitespace-pre overflow-auto rounded-md bg-muted/50 p-3">
          <JsonValue value={body} />
        </pre>
      </div>
    );
  }

  // For JSON strings, try to parse and pretty-print
  const text = String(body);

  if (format === "json") {
    try {
      const parsed = JSON.parse(text);
      return (
        <div className="space-y-2">
          {toolbar}
          <pre className="font-mono text-sm text-foreground/80 whitespace-pre overflow-auto rounded-md bg-muted/50 p-3">
            <JsonValue value={parsed} />
          </pre>
        </div>
      );
    } catch { /* fall through to raw text */ }
  }

  if (format === "form-data") {
    return (
      <div className="space-y-2">
        {toolbar}
        <div className="rounded-md bg-muted/50 p-3">
          <FormDataViewer text={text} />
        </div>
      </div>
    );
  }

  // HTML preview mode
  if (isHtml && preview) {
    return (
      <div className="space-y-2">
        {toolbar}
        <HtmlPreview html={text} baseUrl={baseUrl} />
      </div>
    );
  }

  const highlighter =
    format === "html" || format === "xml" ? <MarkupHighlighter text={text} /> :
    format === "javascript" ? <JsHighlighter text={text} /> :
    format === "graphql" ? <GraphqlHighlighter text={text} /> :
    text;

  return (
    <div className="space-y-2">
      {toolbar}
      <pre className="font-mono text-sm text-foreground/80 whitespace-pre overflow-auto rounded-md bg-muted/50 p-3">
        {highlighter}
      </pre>
    </div>
  );
}

function HeadersTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0)
    return <p className="text-sm italic text-muted-foreground">No headers</p>;
  return (
    <Table>
      <TableBody>
        {entries.map(([k, v]) => (
          <TableRow key={k}>
            <TableCell className="py-1.5 pr-4 font-mono text-muted-foreground whitespace-nowrap align-top">
              {k}
            </TableCell>
            <TableCell className="py-1.5 font-mono text-foreground/80 break-all whitespace-normal">
              {String(v)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────

function DetailPanel({ req }: { req: InspectorRequest }) {
  return (
    <Tabs defaultValue="overview" className="flex flex-col h-full">
      <TabsList variant="line" className="shrink-0 px-2 border-b border-border">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="request">Request</TabsTrigger>
        <TabsTrigger value="response">Response</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground mb-1">Method</p>
              <Badge className={methodBadgeClass(req.method)}>{req.method}</Badge>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Badge className={statusBadgeClass(req.status)}>{req.status}</Badge>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground mb-1">Duration</p>
              <span className="font-mono text-sm">{req.duration}ms</span>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground mb-1">Time</p>
              <span className="font-mono text-sm">
                {new Date(req.startedAt).toLocaleTimeString()}
              </span>
            </CardContent>
          </Card>
        </div>

        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground mb-1">URL</p>
            <span className="font-mono text-sm break-all">{req.url}</span>
          </CardContent>
        </Card>

        {req.error && (
          <Card size="sm" className="ring-destructive/30">
            <CardContent>
              <p className="text-xs text-destructive mb-1">Error</p>
              <span className="font-mono text-sm text-destructive">{req.error}</span>
            </CardContent>
          </Card>
        )}

        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Request Headers
          </h3>
          <HeadersTable headers={req.reqHeaders} />
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Response Headers
          </h3>
          <HeadersTable headers={req.resHeaders} />
        </div>
      </TabsContent>

      <TabsContent value="request" className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Headers
          </h3>
          <HeadersTable headers={req.reqHeaders} />
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Body
          </h3>
          <BodyViewer body={req.reqBody} contentType={req.reqHeaders["content-type"] ?? req.reqHeaders["Content-Type"]} baseUrl={req.url} />
        </div>
      </TabsContent>

      <TabsContent value="response" className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Headers
          </h3>
          <HeadersTable headers={req.resHeaders} />
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Body
          </h3>
          <BodyViewer body={req.resBody} contentType={req.resHeaders["content-type"] ?? req.resHeaders["Content-Type"]} baseUrl={req.url} />
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ── Main page ──────────────────────────────────────────────────────────

export default function InspectorPage() {
  const { requests, connected, clear } = useInspectorFeed();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (methodFilter !== "all" && r.method !== methodFilter) return false;
      if (!statusFilterMatch(r.status, statusFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.method.toLowerCase().includes(q) &&
          !r.url.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [requests, methodFilter, statusFilter, search]);

  const selected = useMemo(
    () => requests.find((r) => r.id === selectedId) ?? null,
    [requests, selectedId]
  );

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-tight">
            Tunnel Inspector
          </h1>
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex items-center gap-1.5 text-xs cursor-default">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      connected ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-red-500"
                    }`}
                  />
                  <span className={connected ? "text-emerald-400" : "text-red-400"}>
                    {connected ? "Connected" : "Disconnected"}
                  </span>
                </span>
              }
            />
            <TooltipContent>
              {connected ? "SSE feed is active" : "Reconnecting to SSE feed..."}
            </TooltipContent>
          </Tooltip>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          {filtered.length} request{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-100 shrink-0 flex flex-col border-r border-border">
          {/* Toolbar */}
          <Card className="rounded-none border-x-0 border-t-0 shrink-0 ring-0 shadow-none">
            <CardContent className="p-2.5 space-y-2">
              <Input
                type="text"
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex gap-2">
                <Select value={methodFilter} onValueChange={(v) => v && setMethodFilter(v)}>
                  <SelectTrigger size="sm" className="flex-1">
                    <SelectValue placeholder="Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
                  <SelectTrigger size="sm" className="flex-1">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="2xx">2xx Success</SelectItem>
                    <SelectItem value="4xx">4xx Client Error</SelectItem>
                    <SelectItem value="5xx">5xx Server Error</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clear();
                    setSelectedId(null);
                  }}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Request list */}
          <ScrollArea className="flex-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-75 text-center px-6">
                <Card size="sm" className="border-dashed bg-transparent shadow-none ring-0">
                  <CardContent className="flex flex-col items-center py-6 px-8">
                    <div className="text-muted-foreground/30 text-4xl mb-3 font-mono">~</div>
                    <p className="text-sm text-muted-foreground">No requests captured</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Send traffic through the proxy on :8080 to see it here
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              filtered.map((r) => (
                <Button
                  key={r.id}
                  variant="ghost"
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full justify-start h-auto px-3 py-2.5 rounded-none border-b border-border/50 gap-2.5 animate-fade-in ${
                    selectedId === r.id
                      ? "bg-accent text-accent-foreground"
                      : ""
                  }`}
                >
                  <Badge className={`shrink-0 text-[10px] font-bold uppercase ${methodBadgeClass(r.method)}`}>
                    {r.method}
                  </Badge>
                  <span className="flex-1 font-mono text-xs text-foreground/80 truncate text-left">
                    {r.url}
                  </span>
                  <Badge className={`shrink-0 text-[10px] font-semibold ${statusBadgeClass(r.status)}`}>
                    {r.status}
                  </Badge>
                  <span className="shrink-0 text-[10px] text-muted-foreground w-12 text-right font-mono">
                    {r.duration}ms
                  </span>
                </Button>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Right panel */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <DetailPanel req={selected} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Card size="sm" className="border-dashed bg-transparent shadow-none">
                <CardContent className="flex flex-col items-center py-8 px-12">
                  <div className="text-muted-foreground/20 text-5xl mb-3 font-mono">
                    {"{ }"}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Select a request to inspect
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
