"use client";

export function HeadersTable({ headers, title }: { headers: Record<string, string>; title: string }) {
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
