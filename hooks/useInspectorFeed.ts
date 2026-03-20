"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface InspectorRequest {
  id: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  startedAt: string;
  reqHeaders: Record<string, string>;
  reqBody: unknown;
  resHeaders: Record<string, string>;
  resBody: unknown;
  error?: string;
}

const SSE_URL = "http://localhost:4040/events";
const RECONNECT_DELAY = 3000;

export function useInspectorFeed() {
  const [requests, setRequests] = useState<InspectorRequest[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    const es = new EventSource(SSE_URL);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.addEventListener("history", (e) => {
      const data = JSON.parse(e.data) as InspectorRequest[];
      setRequests(data);
    });

    es.addEventListener("response", (e) => {
      const entry = JSON.parse(e.data) as InspectorRequest;
      setRequests((prev) => [entry, ...prev].slice(0, 200));
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      setTimeout(connect, RECONNECT_DELAY);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);

  const clear = useCallback(() => setRequests([]), []);

  return { requests, connected, clear };
}
