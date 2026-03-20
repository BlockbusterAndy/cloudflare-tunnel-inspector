"use client";

import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Start the Inspector Proxy",
    description:
      "Run the inspector proxy server which sits between your client and Cloudflare tunnel, capturing all HTTP traffic.",
    code: "npm run inspector",
  },
  {
    number: "02",
    title: "Point Your Traffic to the Proxy",
    description:
      "Configure your application or tool to send requests through the proxy running on port 8080 instead of directly to your tunnel.",
    code: "curl http://localhost:8080/api/v1/users/profile",
  },
  {
    number: "03",
    title: "Inspect in Real-Time",
    description:
      "Open the inspector dashboard to see every request and response flowing through your tunnel — headers, bodies, timing, and status codes.",
    code: "npm run dev",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-on-surface tracking-tight">
          Tunnel Inspector
        </span>
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.08em]">
          v0.1.0
        </span>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="max-w-2xl w-full text-center mb-16">
          {/* Decorative element */}
          <div className="inline-flex items-center gap-2 mb-8">
            <div className="w-8 h-[1px] bg-primary-accent/30" />
            <span className="text-[10px] font-semibold text-primary-accent uppercase tracking-[0.15em]">
              Cloudflare Tunnel Inspector
            </span>
            <div className="w-8 h-[1px] bg-primary-accent/30" />
          </div>

          <h1 className="text-4xl font-semibold text-on-surface tracking-tight leading-tight mb-4">
            See everything flowing
            <br />
            through your tunnel
          </h1>
          <p className="text-on-surface-variant text-base leading-relaxed max-w-lg mx-auto mb-10">
            A real-time HTTP traffic inspector for Cloudflare Tunnels. Capture,
            inspect, and debug every request and response with a premium
            developer experience.
          </p>

          <Link
            href="/inspector"
            className="inline-flex items-center gap-2.5 bg-primary-container text-white text-sm font-semibold px-6 py-2.5 rounded-sm hover:brightness-110 transition-all"
          >
            Open Inspector
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>

        {/* Steps */}
        <div className="max-w-3xl w-full">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-6 text-center">
            Getting Started
          </h2>

          <div className="grid gap-4">
            {steps.map((step) => (
              <div
                key={step.number}
                className="bg-surface-container rounded-sm p-5 flex gap-5 items-start"
              >
                {/* Step number */}
                <span className="text-2xl font-mono font-bold text-primary-accent/20 shrink-0 leading-none pt-0.5">
                  {step.number}
                </span>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-on-surface mb-1">
                    {step.title}
                  </h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
                    {step.description}
                  </p>
                  <div className="bg-surface-lowest rounded-sm px-3 py-2 font-mono text-xs text-method-get">
                    <span className="text-muted-foreground select-none">
                      ${" "}
                    </span>
                    {step.code}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-[10px] text-muted-foreground/50 font-mono">
          Traffic is inspected locally and never leaves your machine.
        </p>
      </footer>
    </div>
  );
}
