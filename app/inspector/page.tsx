"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import { useInspectorFeed, type InspectorRequest } from "../../hooks/useInspectorFeed";
import {
  getMethodStyle,
  getStatusStyle,
  matchesSearch,
  matchesStatusFilter,
  splitUrl,
  toReplayPayload,
  METHOD_FILTERS,
  STATUS_FILTERS,
  type MethodFilter,
  type StatusFilter,
} from "./_components/helpers";
import { DetailPanel } from "./_components/DetailPanel";

const FILTERS_KEY = "tunnel-inspector:filters";

interface StoredFilters {
  search: string;
  method: MethodFilter;
  status: StatusFilter;
}

export default function InspectorPage() {
  const { requests, connected, config, clear, replay } = useInspectorFeed();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  // Restore filters from the last session. This has to run after mount rather
  // than as lazy initial state: localStorage does not exist while prerendering,
  // and seeding from it during render would desync hydration.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FILTERS_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as Partial<StoredFilters>;
      /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from browser storage */
      if (typeof stored.search === "string") setSearch(stored.search);
      if (stored.method && METHOD_FILTERS.includes(stored.method)) setMethodFilter(stored.method);
      if (stored.status && STATUS_FILTERS.includes(stored.status)) setStatusFilter(stored.status);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // Corrupt or unavailable storage — start with the defaults.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ search, method: methodFilter, status: statusFilter } satisfies StoredFilters)
      );
    } catch {
      // Private mode or blocked storage; filters just will not persist.
    }
  }, [search, methodFilter, statusFilter]);

  const filtered = useMemo(
    () =>
      requests.filter(
        (r) =>
          (methodFilter === "All" || r.method === methodFilter) &&
          matchesStatusFilter(r.status, statusFilter) &&
          matchesSearch(r, search)
      ),
    [requests, methodFilter, statusFilter, search]
  );

  const selected = useMemo(
    () => requests.find((r) => r.id === selectedId) ?? null,
    [requests, selectedId]
  );

  const proxyOrigin = config ? `http://localhost:${config.proxyPort}` : undefined;

  const handleReplay = useCallback(
    async (req: InspectorRequest) => {
      await replay(toReplayPayload(req));
    },
    [replay]
  );

  return (
    <div className="h-screen flex flex-col bg-[#131315] text-[#e6e1e5]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-[#131315] shrink-0">
        <div className="flex items-center gap-3">
          <Image src="/images/logo.svg" alt="Logo" width={20} height={20} />
          <h1 className="text-sm font-mono font-semibold tracking-tight text-[#e6e1e5]">
            Tunnel Inspector
          </h1>
          {!connected && (
            <span className="inline-flex items-center gap-1.5 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab]" />
              <span className="text-[#ffb4ab]">Disconnected</span>
            </span>
          )}
          {connected && config && (
            <span className="hidden sm:inline text-[10px] font-mono text-[#908fa0]/70">
              v{config.version} · :{config.proxyPort} → {config.targetHost}:{config.targetPort}
            </span>
          )}
          {config?.redacting && (
            <span
              className="hidden sm:inline text-[9px] font-mono uppercase tracking-wider text-[#4fdbc8] border border-[#4fdbc8]/20 rounded-sm px-1.5 py-0.5"
              title={`Redacting: ${config.redactedHeaders.join(", ")}`}
            >
              Redacted
            </span>
          )}
        </div>
        <button
          onClick={() => {
            clear();
            setSelectedId(null);
          }}
          className="text-[11px] font-semibold tracking-[0.08em] text-[#908fa0] hover:text-[#c7c4d7] transition-colors uppercase"
        >
          Clear Logs
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left panel - Request list */}
        <div
          className="w-[380px] shrink-0 flex flex-col bg-[#131315]"
          style={{ borderRight: "1px solid rgba(70, 69, 84, 0.15)" }}
        >
          {/* Search */}
          <div className="px-3 py-2.5 shrink-0">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#908fa0]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
          <div className="flex items-center gap-1 px-3 pb-1.5 shrink-0">
            {METHOD_FILTERS.map((m) => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-colors ${
                  methodFilter === m
                    ? "bg-[#2a2a2c] text-[#e6e1e5]"
                    : "text-[#908fa0] hover:text-[#c7c4d7] hover:bg-[#201f22]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Status class filter chips */}
          <div className="flex items-center gap-1 px-3 pb-2 shrink-0">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-colors ${
                  statusFilter === s
                    ? "bg-[#2a2a2c] text-[#e6e1e5]"
                    : "text-[#908fa0] hover:text-[#c7c4d7] hover:bg-[#201f22]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Request list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="text-[#908fa0]/20 text-4xl mb-3 font-mono">~</div>
                <p className="text-sm text-[#908fa0]">
                  {requests.length === 0 ? "No requests captured" : "No requests match the filters"}
                </p>
                <p className="text-[11px] text-[#908fa0]/50 mt-1">
                  {requests.length === 0
                    ? "Send traffic through the proxy to see it here"
                    : "Try clearing the search or filter chips"}
                </p>
              </div>
            ) : (
              filtered.map((r) => {
                const methodStyle = getMethodStyle(r.method);
                const statusStyle = getStatusStyle(r.status);
                const isSelected = selectedId === r.id;
                const { path, query } = splitUrl(r.url);

                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors animate-fade-in ${
                      isSelected ? "bg-[#201f22]" : "hover:bg-[#39393b]"
                    }`}
                    style={
                      isSelected
                        ? { borderLeft: "2px solid #c0c1ff" }
                        : { borderLeft: "2px solid transparent" }
                    }
                  >
                    {/* Method badge - ghost border style */}
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase tracking-wider font-mono border rounded-sm px-1.5 py-0.5 ${methodStyle.text} ${methodStyle.border}`}
                    >
                      {r.upgrade ? "WS" : methodStyle.label}
                    </span>

                    {/* URL path + query */}
                    <span className="flex-1 font-mono text-xs text-[#c7c4d7] truncate">
                      {path}
                      {query && <span className="text-[#908fa0]/70">{query}</span>}
                    </span>

                    {r.replayed && (
                      <span className="shrink-0 text-[9px] font-mono text-[#c0c1ff]" title="Replayed request">
                        ↺
                      </span>
                    )}

                    {/* Status */}
                    <span
                      className={`shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-sm ${statusStyle.text} bg-current/10`}
                    >
                      {r.status}
                    </span>

                    {/* Duration */}
                    <span className="shrink-0 text-[10px] text-[#908fa0] font-mono w-12 text-right">
                      {Math.round(r.duration)}ms
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
            <DetailPanel req={selected} onReplay={handleReplay} proxyOrigin={proxyOrigin} />
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
