# Changelog

## [0.2.0](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/compare/v0.1.0...v0.2.0) (2026-08-25)


### ⚠ BREAKING CHANGES

* the proxy and inspector API bind to 127.0.0.1 instead of all interfaces, the API refuses non-loopback origins, and capture entries gained new fields.

### Features

* add helper functions for HTTP method and status styling ([5b72e89](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/5b72e89f90409ed3e6517bc81cebee15448e0173))
* add issue templates for bug reports, feature requests, and good first issues ([3c91217](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/3c9121774ac23235053a11eb3fbf593d75611768))
* add MCP server so AI agents can read and replay captured traffic ([04439d8](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/04439d8c7bc8d0d8e9abdc73920a3c12c0d0da89))
* add project landing page ([660a8ff](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/660a8ff67e1ee6f7a8bbf0411f1cdc3ceaaaf908))
* add replay, copy as cURL, status filters, and persisted search ([b213874](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/b21387412a2673238fc67407485377b2fae2cecf))
* initial commit ([f67ad9e](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/f67ad9efbb7a9742e8f9ab50f240e4a69996c343))
* stream responses, proxy websockets, redact headers, bind to loopback ([d373b5d](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/d373b5d649eaee9afe80dadecccfbbca93ab70d3))


### Bug Fixes

* enhance useInspectorFeed hook for clearing requests ([5b72e89](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/5b72e89f90409ed3e6517bc81cebee15448e0173))
* update CORS settings in proxy server ([5b72e89](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/5b72e89f90409ed3e6517bc81cebee15448e0173))
* update development server port to 3001 and correct target port to 3000 ([47aca95](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/47aca95a04317a372d2f9e4780838ee8334a9116))


### Refactors

* clean up InspectorPage component ([5b72e89](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/5b72e89f90409ed3e6517bc81cebee15448e0173))
* update project name to Tunnel Inspector and add images to README ([c5583e5](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/c5583e5fd8f8c539c645c31f9f7847ea7acd4517))


### Documentation

* add contributing guidelines and ideas for contributions to README ([fb43f0a](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/fb43f0af220c39d0f087ee9a4a03f7ebe5c5463a))
* add traffic flow and request capture lifecycle diagrams to README ([cb54850](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/cb54850cf5aa66d59d2ae3d370143812260fd01a))
* document configuration, MCP server, testing, and versioning ([db696b4](https://github.com/BlockbusterAndy/cloudflare-tunnel-inspector/commit/db696b449bd5101e7fb2ac6b739b196659073c08))
