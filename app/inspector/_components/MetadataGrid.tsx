"use client";

import type { InspectorRequest } from "../../../hooks/useInspectorFeed";
import { getMethodStyle, getStatusStyle, getStatusText } from "./helpers";

export function MetadataGrid({ req }: { req: InspectorRequest }) {
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
