"use client";

import { useState, useMemo } from "react";
import {
  useInspectorFeed,
  type InspectorRequest,
} from "../../hooks/useInspectorFeed";

// ── Helpers ────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-600/20 text-blue-400",
  POST: "bg-amber-600/20 text-amber-400",
  PUT: "bg-teal-600/20 text-teal-400",
  DELETE: "bg-red-600/20 text-red-400",
  PATCH: "bg-purple-600/20 text-purple-400",
};

function methodColor(m: string) {
  return METHOD_COLORS[m] ?? "bg-zinc-700 text-zinc-300";
}

function statusColor(s: number) {
  if (s >= 500) return "bg-red-600/20 text-red-400";
  if (s >= 400) return "bg-amber-600/20 text-amber-400";
  return "bg-green-600/20 text-green-400";
}

function statusFilterMatch(status: number, filter: string) {
  if (filter === "All") return true;
  if (filter === "2xx") return status >= 200 && status < 300;
  if (filter === "4xx") return status >= 400 && status < 500;
  if (filter === "5xx") return status >= 500;
  return true;
}

// ── JSON viewer ────────────────────────────────────────────────────────

function JsonValue({ value, indent = 0 }: { value: unknown; indent?: number }) {
  if (value === null || value === undefined)
    return <span className="text-zinc-500">null</span>;
  if (typeof value === "boolean")
    return <span className="text-amber-400">{String(value)}</span>;
  if (typeof value === "number")
    return <span className="text-teal-400">{value}</span>;
  if (typeof value === "string")
    return <span className="text-green-400">&quot;{value}&quot;</span>;

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

function BodyViewer({ body }: { body: unknown }) {
  if (body === null || body === undefined)
    return <p className="text-zinc-500 italic text-sm">No body</p>;
  if (typeof body === "object") {
    return (
      <pre className="font-mono text-sm text-zinc-300 whitespace-pre overflow-auto">
        <JsonValue value={body} />
      </pre>
    );
  }
  return (
    <pre className="font-mono text-sm text-zinc-300 whitespace-pre-wrap overflow-auto">
      {String(body)}
    </pre>
  );
}

function HeadersTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0)
    return <p className="text-zinc-500 italic text-sm">No headers</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-zinc-800">
            <td className="py-1.5 pr-4 font-mono text-zinc-400 whitespace-nowrap align-top">
              {k}
            </td>
            <td className="py-1.5 font-mono text-zinc-300 break-all">{String(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────

type Tab = "overview" | "request" | "response";

function DetailPanel({ req }: { req: InspectorRequest }) {
  const [tab, setTab] = useState<Tab>("overview");

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "request", label: "Request" },
    { key: "response", label: "Response" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-zinc-800 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "text-zinc-100 border-b-2 border-blue-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="Method">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${methodColor(req.method)}`}
                >
                  {req.method}
                </span>
              </InfoCard>
              <InfoCard label="Status">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${statusColor(req.status)}`}
                >
                  {req.status}
                </span>
              </InfoCard>
              <InfoCard label="Duration">
                <span className="font-mono text-sm text-zinc-300">
                  {req.duration}ms
                </span>
              </InfoCard>
              <InfoCard label="Time">
                <span className="font-mono text-sm text-zinc-300">
                  {new Date(req.startedAt).toLocaleTimeString()}
                </span>
              </InfoCard>
            </div>
            <InfoCard label="URL">
              <span className="font-mono text-sm text-zinc-300 break-all">
                {req.url}
              </span>
            </InfoCard>
            {req.error && (
              <InfoCard label="Error">
                <span className="font-mono text-sm text-red-400">
                  {req.error}
                </span>
              </InfoCard>
            )}
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Request Headers
              </h3>
              <HeadersTable headers={req.reqHeaders} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Response Headers
              </h3>
              <HeadersTable headers={req.resHeaders} />
            </div>
          </>
        )}

        {tab === "request" && (
          <>
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Headers
              </h3>
              <HeadersTable headers={req.reqHeaders} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Body
              </h3>
              <BodyViewer body={req.reqBody} />
            </div>
          </>
        )}

        {tab === "response" && (
          <>
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Headers
              </h3>
              <HeadersTable headers={req.resHeaders} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Body
              </h3>
              <BodyViewer body={req.resBody} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────

export default function InspectorPage() {
  const { requests, connected, clear } = useInspectorFeed();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (methodFilter !== "All" && r.method !== methodFilter) return false;
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
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0 bg-zinc-900">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-tight">
            Tunnel Inspector
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${
              connected ? "text-green-400" : "text-red-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? "bg-green-400" : "bg-red-400"
              }`}
            />
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <span className="text-xs text-zinc-500">
          {filtered.length} request{filtered.length !== 1 ? "s" : ""}
        </span>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-[380px] shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-900">
          {/* Toolbar */}
          <div className="p-2 space-y-2 border-b border-zinc-800 shrink-0">
            <input
              type="text"
              placeholder="Search requests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-zinc-800 rounded-md border border-zinc-700 text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-600"
            />
            <div className="flex gap-2">
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="flex-1 px-2 py-1 text-xs bg-zinc-800 rounded border border-zinc-700 text-zinc-300 outline-none"
              >
                <option>All</option>
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>PATCH</option>
                <option>DELETE</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 px-2 py-1 text-xs bg-zinc-800 rounded border border-zinc-700 text-zinc-300 outline-none"
              >
                <option>All</option>
                <option>2xx</option>
                <option>4xx</option>
                <option>5xx</option>
              </select>
              <button
                onClick={() => {
                  clear();
                  setSelectedId(null);
                }}
                className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 text-zinc-400 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Request list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="text-zinc-600 text-3xl mb-3">~</div>
                <p className="text-sm text-zinc-500">No requests captured</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Send traffic through the proxy on :8080 to see it here
                </p>
              </div>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 border-b border-zinc-800/50 transition-colors ${
                    selectedId === r.id
                      ? "bg-zinc-800"
                      : "hover:bg-zinc-800/50"
                  } animate-fade-in`}
                >
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${methodColor(r.method)}`}
                  >
                    {r.method}
                  </span>
                  <span className="flex-1 font-mono text-xs text-zinc-300 truncate">
                    {r.url}
                  </span>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusColor(r.status)}`}
                  >
                    {r.status}
                  </span>
                  <span className="shrink-0 text-[10px] text-zinc-500 w-12 text-right font-mono">
                    {r.duration}ms
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 min-w-0 bg-zinc-950">
          {selected ? (
            <DetailPanel req={selected} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-zinc-700 text-4xl mb-3">{"{ }"}</div>
              <p className="text-sm text-zinc-500">
                Select a request to inspect
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
