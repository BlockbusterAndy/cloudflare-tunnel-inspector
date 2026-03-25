"use client";

import { useState } from "react";
import type { InspectorRequest } from "../../../hooks/useInspectorFeed";
import { MetadataGrid } from "./MetadataGrid";
import { HeadersTable } from "./HeadersTable";
import { BodyViewer } from "./BodyViewer";

export function DetailPanel({ req }: { req: InspectorRequest }) {
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
