import { describe, it, expect } from "vitest";
import { resolveConfig, isAllowedOrigin, DEFAULT_REDACTED_HEADERS } from "../server/config.mjs";

describe("resolveConfig", () => {
  it("falls back to defaults", () => {
    const config = resolveConfig([], {});
    expect(config.proxyPort).toBe(8080);
    expect(config.inspectorPort).toBe(4040);
    expect(config.targetPort).toBe(3000);
    expect(config.proxyHost).toBe("127.0.0.1");
    expect(config.redact).toEqual([]);
  });

  it("reads environment variables", () => {
    const config = resolveConfig([], { TARGET_PORT: "9000", MAX_ENTRIES: "50" });
    expect(config.targetPort).toBe(9000);
    expect(config.maxEntries).toBe(50);
  });

  it("lets CLI flags win over the environment", () => {
    const config = resolveConfig(["--target-port", "7000"], { TARGET_PORT: "9000" });
    expect(config.targetPort).toBe(7000);
  });

  it("accepts --flag=value form", () => {
    expect(resolveConfig(["--target-port=7000"], {}).targetPort).toBe(7000);
  });

  it("turns bare --redact into the default header list", () => {
    expect(resolveConfig(["--redact"], {}).redact).toEqual(DEFAULT_REDACTED_HEADERS);
  });

  it("accepts an explicit redaction list, lowercased", () => {
    expect(resolveConfig(["--redact", "Authorization,X-Secret"], {}).redact).toEqual([
      "authorization",
      "x-secret",
    ]);
  });

  it("parses boolean flags", () => {
    expect(resolveConfig(["--rewrite-host"], {}).rewriteHost).toBe(true);
    expect(resolveConfig([], {}).rewriteHost).toBe(false);
  });

  it("rejects unknown flags and bad ports", () => {
    expect(() => resolveConfig(["--nope", "1"], {})).toThrow(/Unknown flag/);
    expect(() => resolveConfig(["--target-port", "99999"], {})).toThrow(/Invalid value/);
  });
});

describe("isAllowedOrigin", () => {
  it("allows any loopback origin when no allowlist is configured", () => {
    expect(isAllowedOrigin("http://localhost:3001", [])).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:5173", [])).toBe(true);
  });

  it("refuses non-loopback origins", () => {
    expect(isAllowedOrigin("http://192.168.1.5:3001", [])).toBe(false);
    expect(isAllowedOrigin("https://evil.example.com", [])).toBe(false);
    expect(isAllowedOrigin("", [])).toBe(false);
    expect(isAllowedOrigin("not a url", [])).toBe(false);
  });

  it("honours an explicit allowlist exactly", () => {
    const list = ["http://localhost:3001"];
    expect(isAllowedOrigin("http://localhost:3001", list)).toBe(true);
    expect(isAllowedOrigin("http://localhost:9999", list)).toBe(false);
  });
});
