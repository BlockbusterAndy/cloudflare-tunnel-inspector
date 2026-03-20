# Contributing to Tunnel Inspector

Thanks for your interest in contributing! This is a small, focused tool and contributions of all sizes are welcome — from fixing a typo to building WebSocket support.

## Ways to contribute

- **Report a bug** — open a [bug report issue](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/issues/new?template=bug_report.md)
- **Suggest a feature** — open a [feature request](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/issues/new?template=feature_request.md)
- **Pick up an issue** — browse [good first issues](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/issues?q=is%3Aopen+label%3A%22good+first+issue%22) if you're new to the codebase
- **Improve docs** — README, inline comments, or this file

## Local setup

### Prerequisites
- Node.js >= 20
- npm >= 9

### Steps

```bash
# 1. Fork the repo, then clone your fork
git clone https://github.com/YOUR_USERNAME/cloudflare-tunnel-inspector.git
cd cloudflare-tunnel-inspector

# 2. Install dependencies
npm install

# 3. Start the dev server + proxy together
npm run dev:inspect
```

Open [http://localhost:3000/inspector](http://localhost:3000/inspector) — you should see the inspector dashboard.

To send test traffic through the proxy:
```bash
curl http://localhost:8080/any/path
```

## Project structure

```
├── server/proxy.mjs          # Standalone Node.js proxy (zero deps)
├── app/
│   ├── page.tsx              # Landing page
│   └── inspector/page.tsx    # Inspector dashboard (main UI)
├── hooks/useInspectorFeed.ts # SSE connection hook
├── app/globals.css           # Design tokens (Obsidian Lens system)
└── DESIGN.md                 # Full design system spec
```

## Making changes

### Branch naming
```
feat/short-description       # new feature
fix/short-description        # bug fix
docs/short-description       # documentation only
refactor/short-description   # code change without behaviour change
```

### Commit messages
Keep them short and use the present tense:
```
feat: add WebSocket inspection support
fix: prevent SSE client leak on disconnect
docs: update proxy architecture diagram
```

### Code style
- TypeScript for all new files in `app/` and `hooks/`
- Plain `.mjs` for the proxy server — no TypeScript, no npm deps
- Tailwind CSS for styling — no new CSS files unless updating design tokens
- Follow the existing patterns in the file you're editing

### Design system
The UI follows the **Obsidian Lens** spec in [DESIGN.md](DESIGN.md). Key rules:
- No solid borders for layout — use background color shifts instead
- `JetBrains Mono` for all technical data (URLs, headers, bodies)
- `Inter` for all UI labels and navigation
- Sharp corners (`rounded-sm`) throughout — no large border radii

## Opening a PR

1. Make sure your branch is up to date with `main`
2. Run `npm run lint` and fix any errors
3. Test manually — run `npm run dev:inspect` and exercise the feature you changed
4. Open a PR against `main` with a clear description of what changed and why
5. Link the related issue with `Closes #123`

PRs don't need to be perfect — if you're stuck or want early feedback, open a draft PR and leave a comment.

## What's in scope

Good areas to contribute right now:

| Area | Notes |
|---|---|
| WebSocket inspection | Currently forwarded but not captured |
| Request replay | Re-fire a captured request from the UI |
| Status code filter | Filter list by 2xx / 4xx / 5xx |
| Export logs | Download buffer as `.ndjson` |
| CLI wrapper | `npx cloudflare-tunnel-inspector` |
| Test coverage | The proxy logic has no tests yet |
| Better error states | UI when proxy is unreachable |

## Questions?

Open an issue or start a discussion on GitHub. Response time is usually within a day or two.
