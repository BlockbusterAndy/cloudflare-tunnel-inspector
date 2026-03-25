"use client";

// ── HTML / XML syntax highlighter ─────────────────────────────────────

export function MarkupHighlighter({ text }: { text: string }) {
  const tokens: React.ReactNode[] = [];
  const re = /(<!--[\s\S]*?-->)|(<\/?\s*)([\w:.-]+)((?:\s+[\w:.-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?)*)\s*(\/?>)|([^<]+)/g;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = re.exec(text)) !== null) {
    if (match[1]) {
      tokens.push(<span key={i++} style={{ color: "#6a6a7a", fontStyle: "italic" }}>{match[1]}</span>);
    } else if (match[2]) {
      tokens.push(<span key={i++} style={{ color: "#808080" }}>{match[2]}</span>);
      tokens.push(<span key={i++} style={{ color: "#569cd6" }}>{match[3]}</span>);
      if (match[4]) {
        const attrRe = /([\w:.-]+)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s>]*)?/g;
        let attrMatch: RegExpExecArray | null;
        const attrStr = match[4];
        while ((attrMatch = attrRe.exec(attrStr)) !== null) {
          if (!attrMatch[0].trim()) continue;
          tokens.push(<span key={i++} style={{ color: "#9cdcfe" }}>{" "}{attrMatch[1]}</span>);
          if (attrMatch[2]) {
            tokens.push(<span key={i++} style={{ color: "#e6e1e5" }}>{attrMatch[2]}</span>);
            if (attrMatch[3]) {
              tokens.push(<span key={i++} style={{ color: "#ce9178" }}>{attrMatch[3]}</span>);
            }
          }
        }
      }
      tokens.push(<span key={i++} style={{ color: "#808080" }}>{match[5]}</span>);
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

export function JsHighlighter({ text }: { text: string }) {
  const tokens: React.ReactNode[] = [];
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\b[a-zA-Z_$][\w$]*\b)|(=>|[{}()[\];,.:?!&|<>=+\-*/%~^]+)/g;
  let match: RegExpExecArray | null;
  let i = 0;
  let lastIndex = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(<span key={i++}>{text.slice(lastIndex, match.index)}</span>);
    }
    if (match[1]) tokens.push(<span key={i++} style={{ color: "#6a6a7a", fontStyle: "italic" }}>{match[1]}</span>);
    else if (match[2]) tokens.push(<span key={i++} style={{ color: "#ce9178" }}>{match[2]}</span>);
    else if (match[3]) tokens.push(<span key={i++} style={{ color: "#b5cea8" }}>{match[3]}</span>);
    else if (match[4]) {
      const color = JS_KEYWORDS.has(match[4]) ? "#c586c0"
        : /^[A-Z]/.test(match[4]) ? "#4ec9b0" : "#9cdcfe";
      const fontWeight = JS_KEYWORDS.has(match[4]) ? "600" : undefined;
      tokens.push(<span key={i++} style={{ color, fontWeight }}>{match[4]}</span>);
    } else if (match[5]) tokens.push(<span key={i++} style={{ color: "#d4d4d4" }}>{match[5]}</span>);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) tokens.push(<span key={i++}>{text.slice(lastIndex)}</span>);
  return <>{tokens}</>;
}

// ── GraphQL syntax highlighter ────────────────────────────────────────

const GQL_KEYWORDS = new Set([
  "query", "mutation", "subscription", "fragment", "on", "type", "input",
  "enum", "scalar", "interface", "union", "extend", "schema", "directive",
  "implements", "true", "false", "null",
]);

export function GraphqlHighlighter({ text }: { text: string }) {
  const tokens: React.ReactNode[] = [];
  const re = /(#[^\n]*)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(\$\w+)|(@\w+)|(\b[a-zA-Z_]\w*\b)|([{}()[\]:!=,.|&…]+)/g;
  let match: RegExpExecArray | null;
  let i = 0;
  let lastIndex = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(<span key={i++}>{text.slice(lastIndex, match.index)}</span>);
    }
    if (match[1]) tokens.push(<span key={i++} style={{ color: "#6a6a7a", fontStyle: "italic" }}>{match[1]}</span>);
    else if (match[2]) tokens.push(<span key={i++} style={{ color: "#ce9178" }}>{match[2]}</span>);
    else if (match[3]) tokens.push(<span key={i++} style={{ color: "#b5cea8" }}>{match[3]}</span>);
    else if (match[4]) tokens.push(<span key={i++} style={{ color: "#f59e0b" }}>{match[4]}</span>);
    else if (match[5]) tokens.push(<span key={i++} style={{ color: "#c084fc" }}>{match[5]}</span>);
    else if (match[6]) {
      const color = GQL_KEYWORDS.has(match[6]) ? "#c084fc"
        : /^[A-Z]/.test(match[6]) ? "#f59e0b" : "#9cdcfe";
      const fontWeight = GQL_KEYWORDS.has(match[6]) ? "600" : undefined;
      tokens.push(<span key={i++} style={{ color, fontWeight }}>{match[6]}</span>);
    } else if (match[7]) tokens.push(<span key={i++} style={{ color: "#908fa0" }}>{match[7]}</span>);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) tokens.push(<span key={i++}>{text.slice(lastIndex)}</span>);
  return <>{tokens}</>;
}

// ── JSON viewer ────────────────────────────────────────────────────────

export function JsonValue({ value, indent = 0 }: { value: unknown; indent?: number }) {
  if (value === null || value === undefined)
    return <span style={{ color: "#908fa0" }}>null</span>;
  if (typeof value === "boolean")
    return <span style={{ color: "#c084fc" }}>{String(value)}</span>;
  if (typeof value === "number")
    return <span style={{ color: "#b5cea8" }}>{value}</span>;
  if (typeof value === "string")
    return <span style={{ color: "#ce9178" }}>&quot;{value}&quot;</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: "#e6e1e5" }}>{"[]"}</span>;
    return (
      <span>
        <span style={{ color: "#e6e1e5" }}>{"["}</span>{"\n"}
        {value.map((item, i) => (
          <span key={i}>
            {"  ".repeat(indent + 1)}
            <JsonValue value={item} indent={indent + 1} />
            {i < value.length - 1 ? <span style={{ color: "#e6e1e5" }}>,</span> : null}
            {"\n"}
          </span>
        ))}
        {"  ".repeat(indent)}
        <span style={{ color: "#e6e1e5" }}>{"]"}</span>
      </span>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span style={{ color: "#e6e1e5" }}>{"{}"}</span>;
    return (
      <span>
        <span style={{ color: "#e6e1e5" }}>{"{"}</span>{"\n"}
        {entries.map(([k, v], i) => (
          <span key={k}>
            {"  ".repeat(indent + 1)}
            <span style={{ color: "#9cdcfe" }}>&quot;{k}&quot;</span>
            <span style={{ color: "#e6e1e5" }}>{": "}</span>
            <JsonValue value={v} indent={indent + 1} />
            {i < entries.length - 1 ? <span style={{ color: "#e6e1e5" }}>,</span> : null}
            {"\n"}
          </span>
        ))}
        {"  ".repeat(indent)}
        <span style={{ color: "#e6e1e5" }}>{"}"}</span>
      </span>
    );
  }

  return <span>{String(value)}</span>;
}

// ── Form-data viewer ──────────────────────────────────────────────────

export function FormDataViewer({ text }: { text: string }) {
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

export function MultipartViewer({ text }: { text: string }) {
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

// ── GraphQL-over-JSON viewer ──────────────────────────────────────────

export function GraphqlJsonViewer({ body }: { body: Record<string, unknown> }) {
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
