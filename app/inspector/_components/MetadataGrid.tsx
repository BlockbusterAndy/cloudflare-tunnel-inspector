"use client";

import type { InspectorRequest } from "../../../hooks/useInspectorFeed";
import { getMethodStyle, getStatusStyle, getStatusText, formatBytes, splitUrl } from "./helpers";

const ROW_BORDER = { borderTop: "1px solid rgba(70, 69, 84, 0.15)" };

function Cell({ label, children, alt = false }: { label: string; children: React.ReactNode; alt?: boolean }) {
  return (
    <div className={`px-4 py-3 flex items-center justify-between gap-4 ${alt ? "bg-[#1a1a1c]" : ""}`}>
      <span className="text-sm text-[#908fa0] shrink-0">{label}</span>
      <span className="font-mono text-sm text-[#c7c4d7] text-right truncate">{children}</span>
    </div>
  );
}

export function MetadataGrid({ req }: { req: InspectorRequest }) {
  const methodStyle = getMethodStyle(req.method);
  const statusStyle = getStatusStyle(req.status);
  const statusText = getStatusText(req.status);
  const { path, query } = splitUrl(req.url);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[10px] font-semibold text-[#908fa0] uppercase tracking-[0.05em]">Metadata</h3>
        {req.replayed && (
          <span className="text-[9px] font-mono uppercase tracking-wider text-[#c0c1ff] border border-[#c0c1ff]/20 rounded-sm px-1.5 py-0.5">
            Replayed
          </span>
        )}
        {req.upgrade && (
          <span className="text-[9px] font-mono uppercase tracking-wider text-[#c084fc] border border-[#c084fc]/20 rounded-sm px-1.5 py-0.5">
            WebSocket
          </span>
        )}
      </div>

      <div className="bg-[#201f22] rounded-sm overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <Cell label="Method">
            <span className={`font-bold ${methodStyle.text}`}>{req.method}</span>
          </Cell>
          <Cell label="Status" alt>
            <span className={`font-bold ${statusStyle.text}`}>
              {req.status} {statusText}
            </span>
          </Cell>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2" style={ROW_BORDER}>
          <Cell label="Duration">{req.duration.toFixed(2)} ms</Cell>
          <Cell label="TTFB" alt>
            {req.ttfb === null || req.ttfb === undefined ? "—" : `${req.ttfb.toFixed(2)} ms`}
          </Cell>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2" style={ROW_BORDER}>
          <Cell label="Size">
            {formatBytes(req.reqBodySize)} ↑ / {formatBytes(req.resBodySize)} ↓
          </Cell>
          <Cell label="Time" alt>
            {new Date(req.startedAt).toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              fractionalSecondDigits: 3,
            })}
          </Cell>
        </div>

        <div style={ROW_BORDER}>
          <div className="px-4 py-3 flex items-start justify-between gap-4">
            <span className="text-sm text-[#908fa0] shrink-0">URL</span>
            <span className="font-mono text-sm text-[#c7c4d7] text-right break-all">
              {path}
              {query && <span className="text-[#908fa0]">{query}</span>}
            </span>
          </div>
        </div>

        {req.error && (
          <div style={ROW_BORDER}>
            <div className="px-4 py-3 flex items-start justify-between gap-4">
              <span className="text-sm text-[#908fa0] shrink-0">Error</span>
              <span className="font-mono text-sm text-[#ffb4ab] text-right break-all">{req.error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
