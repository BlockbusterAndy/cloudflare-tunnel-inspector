# Cloudflare Tunnel Inspector

A local HTTP request inspector for Cloudflare Tunnels — like ngrok's inspector, but for `cloudflared`. It sits between `cloudflared` and your app, captures all traffic, and displays it in a real-time UI.

## How it works

```
Internet → cloudflared → Proxy (:8080) → Your App (:3000)
                             ↓
                        SSE (:4040)
                             ↓
                     Inspector UI (/inspector)
```

A standalone Node.js proxy server intercepts all HTTP traffic on port 8080 and forwards it to your app on port 3000. Every request/response pair is captured and broadcast over Server-Sent Events (SSE) on port 4040. The Next.js inspector page at `/inspector` connects to the SSE stream and renders a live feed.

## Quick start

```bash
npm install
npm run dev:inspect
```

This starts both the Next.js dev server (`:3000`) and the proxy server (`:8080`) concurrently.

Then open [http://localhost:3000/inspector](http://localhost:3000/inspector) in your browser.

### Point cloudflared at the proxy

Update your cloudflared config to route traffic to `localhost:8080` instead of `localhost:3000`:

```yaml
# ~/.cloudflared/config.yml
tunnel: your-tunnel-id
credentials-file: ~/.cloudflared/your-tunnel-id.json

ingress:
  - hostname: yourdomain.com
    service: http://localhost:8080  # ← proxy port, not app port
  - service: http_status:404
```

Then restart cloudflared:

```bash
cloudflared tunnel run your-tunnel-name
```

All traffic through the tunnel will now appear in the inspector.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start only the Next.js dev server on `:3000` |
| `npm run inspector` | Start only the proxy server (`:8080` proxy, `:4040` SSE) |
| `npm run dev:inspect` | Start both Next.js and the proxy concurrently |

## Architecture

### Proxy server — `server/proxy.mjs`

A zero-dependency Node.js HTTP proxy (uses only the built-in `http` module):

- **Proxy** (`:8080`): Receives requests from `cloudflared`, forwards them to `localhost:3000`, and captures the full request/response cycle.
- **SSE/API** (`:4040`): Serves two endpoints:
  - `GET /events` — SSE stream. On connect, sends a `history` event with the full buffer, then streams `response` events as new requests arrive.
  - `GET /api/requests` — Returns the last 200 captured entries as JSON.

Each captured entry includes:
- Unique ID (timestamp + random suffix)
- HTTP method, URL, status code
- Duration in milliseconds
- Request and response headers
- Request and response bodies (auto-parsed as JSON when possible)

Entries are stored in a circular buffer capped at 200 items.

### Inspector UI — `app/inspector/page.tsx`

A full-viewport, dark-themed inspector interface with a split-panel layout:

**Left panel (380px):**
- Scrollable list of captured requests
- Each row shows method (color-coded badge), URL path, status badge, and duration
- Toolbar with text search, method filter (All/GET/POST/PUT/PATCH/DELETE), status filter (All/2xx/4xx/5xx), and clear button
- New requests appear at the top with a subtle flash animation

**Right panel (flex):**
- Three tabs: Overview, Request, Response
- **Overview**: Method, status, duration, timestamp, full request/response headers
- **Request**: Headers table and body viewer with syntax-highlighted JSON
- **Response**: Same structure as Request tab

### SSE hook — `hooks/useInspectorFeed.ts`

A React hook that manages the SSE connection:
- Connects to `http://localhost:4040/events`
- Handles `history` (bulk load) and `response` (single entry) events
- Auto-reconnects on disconnect with a 3-second delay
- Returns `{ requests, connected, clear }`

## Ports

| Port | Service |
|---|---|
| 3000 | Your Next.js app (dev server) |
| 8080 | Proxy server (point cloudflared here) |
| 4040 | SSE/API server (inspector UI connects here) |

## Limitations

- The proxy buffers full request and response bodies in memory. Very large payloads (file uploads, streaming responses) may cause high memory usage.
- Only HTTP traffic is captured. WebSocket upgrade requests are forwarded but not inspected.
- The circular buffer is in-memory only — restarting the proxy clears all captured data.
- The inspector UI filters are client-side only. All 200 buffered entries are always sent to the browser.
