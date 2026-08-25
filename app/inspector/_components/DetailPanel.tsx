"use client";

import { useState } from "react";
import type { InspectorRequest } from "../../../hooks/useInspectorFeed";
import { MetadataGrid } from "./MetadataGrid";
import { HeadersTable } from "./HeadersTable";
import { BodyViewer } from "./BodyViewer";
import { CopyButton } from "./CopyButton";
import { toCurl } from "./helpers";

type ReplayState = "idle" | "sending" | "sent" | "error";

export function DetailPanel({
  req,
  onReplay,
  proxyOrigin,
}: {
  req: InspectorRequest;
  onReplay?: (req: InspectorRequest) => Promise<void>;
  proxyOrigin?: string;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "request" | "response">("overview");
  const [replayState, setReplayState] = useState<ReplayState>("idle");
  const [replayError, setReplayError] = useState<string | null>(null);

  const tabs = [
    { id: "overview" as const, label: "OVERVIEW" },
    { id: "request" as const, label: "REQUEST" },
    { id: "response" as const, label: "RESPONSE" },
  ];

  const reqContentType = req.reqHeaders["content-type"] ?? req.reqHeaders["Content-Type"];
  const resContentType = req.resHeaders["content-type"] ?? req.resHeaders["Content-Type"];

  const requestBody = (
    <BodyViewer
      body={req.reqBody}
      contentType={reqContentType}
      size={req.reqBodySize}
      binary={req.reqBodyBinary}
      truncated={req.reqBodyTruncated}
    />
  );

  const responseBody = (
    <BodyViewer
      body={req.resBody}
      contentType={resContentType}
      size={req.resBodySize}
      binary={req.resBodyBinary}
      truncated={req.resBodyTruncated}
    />
  );

  async function handleReplay() {
    if (!onReplay || replayState === "sending") return;
    setReplayState("sending");
    setReplayError(null);
    try {
      await onReplay(req);
      setReplayState("sent");
      setTimeout(() => setReplayState("idle"), 2000);
    } catch (err) {
      setReplayError(err instanceof Error ? err.message : "Replay failed");
      setReplayState("error");
      setTimeout(() => setReplayState("idle"), 4000);
    }
  }

  const replayLabel =
    replayState === "sending" ? "Replaying…" : replayState === "sent" ? "Replayed" : replayState === "error" ? "Failed" : "Replay";

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar + actions */}
      <div className="flex items-center justify-between gap-2 bg-[#2a2a2c] shrink-0">
        <div className="flex items-center">
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

        <div className="flex items-center gap-1 pr-3">
          <CopyButton text={toCurl(req, proxyOrigin)} label="Copy as cURL" />
          {onReplay && !req.upgrade && (
            <button
              onClick={handleReplay}
              disabled={replayState === "sending"}
              title={replayError ?? "Re-send this request through the proxy"}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-mono transition-colors disabled:opacity-60 ${
                replayState === "error"
                  ? "text-[#ffb4ab] hover:bg-[#39393b]"
                  : replayState === "sent"
                    ? "text-[#4fdbc8]"
                    : "text-[#908fa0] hover:text-[#c7c4d7] hover:bg-[#39393b]"
              }`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {replayLabel}
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === "overview" && (
          <>
            <MetadataGrid req={req} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <HeadersTable headers={req.reqHeaders} title="Request Headers" />
              <HeadersTable headers={req.resHeaders} title="Response Headers" />
            </div>

            {responseBody}
          </>
        )}

        {activeTab === "request" && (
          <>
            <HeadersTable headers={req.reqHeaders} title="Request Headers" />
            <div className="mt-6">{requestBody}</div>
          </>
        )}

        {activeTab === "response" && (
          <>
            <HeadersTable headers={req.resHeaders} title="Response Headers" />
            <div className="mt-6">{responseBody}</div>
          </>
        )}
      </div>
    </div>
  );
}
