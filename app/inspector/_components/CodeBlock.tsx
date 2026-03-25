"use client";

import { CopyButton } from "./CopyButton";

export function CodeBlock({ children, rawText, label, size }: { children: React.ReactNode; rawText: string; label: string; size?: string }) {
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
