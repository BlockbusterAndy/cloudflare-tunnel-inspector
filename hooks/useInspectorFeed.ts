"use client";

import { useState, useEffect, useCallback } from "react";

export interface InspectorRequest {
  id: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  /** Time to first byte in ms; null for errors and upgrades. */
  ttfb: number | null;
  startedAt: string;
  reqHeaders: Record<string, string>;
  reqBody: unknown;
  reqBodySize: number;
  reqBodyTruncated: boolean;
  reqBodyBinary: boolean;
  resHeaders: Record<string, string>;
  resBody: unknown;
  resBodySize: number;
  resBodyTruncated: boolean;
  resBodyBinary: boolean;
  /** True when this entry was produced by replaying an earlier request. */
  replayed?: boolean;
  /** True for WebSocket / protocol upgrades. */
  upgrade?: boolean;
  protocol?: string;
  error?: string;
}

export interface InspectorConfig {
  /** Proxy version, from package.json. */
  version: string;
  proxyPort: number;
  targetHost: string;
  targetPort: number;
  maxEntries: number;
  maxBodyBytes: number;
  redacting: boolean;
  redactedHeaders: string[];
}

export interface ReplayPayload {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

const BASE_URL = process.env.NEXT_PUBLIC_INSPECTOR_URL ?? "http://localhost:4040";
const SSE_URL = `${BASE_URL}/events`;
const CLEAR_URL = `${BASE_URL}/api/clear`;
const REPLAY_URL = `${BASE_URL}/api/replay`;
const CONFIG_URL = `${BASE_URL}/api/config`;

const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30_000;
/** Client-side cap; the server enforces its own via --max-entries. */
const MAX_CLIENT_ENTRIES = 500;

export function useInspectorFeed() {
  const [requests, setRequests] = useState<InspectorRequest[]>([]);
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<InspectorConfig | null>(null);

  useEffect(() => {
    let disposed = false;
    let attempts = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let source: EventSource | null = null;

    function connect() {
      if (disposed) return;

      const es = new EventSource(SSE_URL);
      source = es;

      es.onopen = () => {
        attempts = 0;
        setConnected(true);
      };

      es.addEventListener("history", (e) => {
        setRequests(JSON.parse(e.data) as InspectorRequest[]);
      });

      es.addEventListener("response", (e) => {
        const entry = JSON.parse(e.data) as InspectorRequest;
        setRequests((prev) => [entry, ...prev].slice(0, MAX_CLIENT_ENTRIES));
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        if (disposed) return;

        // Exponential backoff, so a stopped proxy is not hammered on a fixed timer.
        const delay = Math.min(MIN_RECONNECT_DELAY * 2 ** attempts, MAX_RECONNECT_DELAY);
        attempts += 1;
        retry = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      // Without this, a pending retry would reopen the stream after unmount.
      disposed = true;
      clearTimeout(retry);
      source?.close();
    };
  }, []);

  // Proxy settings, so the UI can show the real ports and redaction state.
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    fetch(CONFIG_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setConfig(data as InspectorConfig);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [connected]);

  const clear = useCallback(() => {
    setRequests([]);
    fetch(CLEAR_URL, { method: "DELETE" }).catch(() => {});
  }, []);

  const replay = useCallback(async (payload: ReplayPayload) => {
    const res = await fetch(REPLAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error(detail?.error ?? `Replay failed (${res.status})`);
    }
    return res.json() as Promise<{ ok: true; status: number }>;
  }, []);

  return { requests, connected, config, clear, replay };
}
