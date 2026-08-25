import { describe, it, expect } from "vitest";
import {
  detectFormat,
  isGraphqlJson,
  splitUrl,
  formatBytes,
  matchesStatusFilter,
  matchesSearch,
  toCurl,
  toReplayPayload,
  getStatusStyle,
  getMethodStyle,
  REDACTED_VALUE,
} from "../app/inspector/_components/helpers";
import type { InspectorRequest } from "../hooks/useInspectorFeed";

function makeRequest(overrides: Partial<InspectorRequest> = {}): InspectorRequest {
  return {
    id: "1",
    method: "POST",
    url: "/api/users?page=2",
    status: 201,
    duration: 12.5,
    ttfb: 4.2,
    startedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    reqHeaders: { "content-type": "application/json", host: "example.com", "content-length": "9" },
    reqBody: { a: 1 },
    reqBodySize: 7,
    reqBodyTruncated: false,
    reqBodyBinary: false,
    resHeaders: { "content-type": "application/json" },
    resBody: { ok: true },
    resBodySize: 11,
    resBodyTruncated: false,
    resBodyBinary: false,
    ...overrides,
  };
}

describe("splitUrl", () => {
  it("separates path from query", () => {
    expect(splitUrl("/api/users?page=2&q=a")).toEqual({ path: "/api/users", query: "?page=2&q=a" });
  });

  it("handles a bare path", () => {
    expect(splitUrl("/health")).toEqual({ path: "/health", query: "" });
  });

  it("strips the origin from absolute-form URLs", () => {
    expect(splitUrl("http://example.com/a/b?c=1")).toEqual({ path: "/a/b", query: "?c=1" });
    expect(splitUrl("http://example.com")).toEqual({ path: "/", query: "" });
  });

  it("drops the fragment", () => {
    expect(splitUrl("/a?b=1#frag")).toEqual({ path: "/a", query: "?b=1" });
  });
});

describe("formatBytes", () => {
  it("scales units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(undefined)).toBe("");
  });
});

describe("filters", () => {
  it("matches status classes", () => {
    expect(matchesStatusFilter(204, "2xx")).toBe(true);
    expect(matchesStatusFilter(404, "2xx")).toBe(false);
    expect(matchesStatusFilter(503, "5xx")).toBe(true);
    expect(matchesStatusFilter(302, "All")).toBe(true);
  });

  it("searches method, url and status", () => {
    const req = makeRequest();
    expect(matchesSearch(req, "")).toBe(true);
    expect(matchesSearch(req, "users")).toBe(true);
    expect(matchesSearch(req, "post")).toBe(true);
    expect(matchesSearch(req, "201")).toBe(true);
    expect(matchesSearch(req, "nothing")).toBe(false);
  });
});

describe("detectFormat", () => {
  it("recognises parsed JSON objects", () => {
    expect(detectFormat({ a: 1 })).toBe("json");
  });

  it("recognises GraphQL over JSON", () => {
    const body = { query: "query Me { me { id } }" };
    expect(isGraphqlJson(body)).toBe(true);
    expect(detectFormat(body)).toBe("graphql-json");
  });

  it("uses the content type when the body is a string", () => {
    expect(detectFormat("<p>hi</p>", "text/html; charset=utf-8")).toBe("html");
    expect(detectFormat("a=1&b=2", "application/x-www-form-urlencoded")).toBe("form-data");
  });

  it("sniffs the body when no content type is given", () => {
    expect(detectFormat("<!DOCTYPE html><html></html>")).toBe("html");
    expect(detectFormat("a=1&b=2")).toBe("form-data");
    expect(detectFormat("just some words")).toBe("text");
  });
});

describe("toCurl", () => {
  it("targets the proxy and includes headers and body", () => {
    const curl = toCurl(makeRequest(), "http://localhost:8080");
    expect(curl).toContain("curl -X POST 'http://localhost:8080/api/users?page=2'");
    expect(curl).toContain("-H 'content-type: application/json'");
    expect(curl).toContain(`--data-raw '{"a":1}'`);
  });

  it("omits headers cURL must recompute", () => {
    const curl = toCurl(makeRequest());
    expect(curl).not.toContain("content-length");
    expect(curl).not.toContain("-H 'host:");
  });

  it("escapes single quotes in values", () => {
    const curl = toCurl(makeRequest({ reqBody: "it's" }));
    expect(curl).toContain(`'it'\\''s'`);
  });

  it("notes binary bodies instead of inlining them", () => {
    const curl = toCurl(makeRequest({ reqBodyBinary: true, reqBodySize: 2048 }));
    expect(curl).toContain("binary body omitted");
  });

  it("leaves out redacted headers and says so", () => {
    const curl = toCurl(
      makeRequest({ reqHeaders: { authorization: REDACTED_VALUE, accept: "*/*" } })
    );
    expect(curl).not.toContain(REDACTED_VALUE);
    expect(curl.split("\n")[0]).toBe("# redacted headers omitted: authorization");
    expect(curl).toContain("-H 'accept: */*'");
  });
});

describe("toReplayPayload", () => {
  it("drops framing headers the proxy recomputes", () => {
    const payload = toReplayPayload(makeRequest());
    expect(payload.headers).not.toHaveProperty("content-length");
    expect(payload.headers).not.toHaveProperty("host");
    expect(payload.headers["content-type"]).toBe("application/json");
    expect(payload.method).toBe("POST");
    expect(payload.url).toBe("/api/users?page=2");
    expect(payload.body).toEqual({ a: 1 });
  });

  it("never replays a binary body it did not capture", () => {
    expect(toReplayPayload(makeRequest({ reqBodyBinary: true })).body).toBeNull();
  });

  it("drops redacted headers rather than replaying the placeholder", () => {
    const payload = toReplayPayload(
      makeRequest({ reqHeaders: { authorization: REDACTED_VALUE, accept: "*/*" } })
    );
    expect(payload.headers).not.toHaveProperty("authorization");
    expect(payload.headers.accept).toBe("*/*");
  });
});

describe("styling helpers", () => {
  it("buckets status colours", () => {
    expect(getStatusStyle(204).text).toBe(getStatusStyle(200).text);
    expect(getStatusStyle(500).text).not.toBe(getStatusStyle(200).text);
  });

  it("falls back for unknown methods", () => {
    expect(getMethodStyle("TRACE").label).toBe("TRACE");
    expect(getMethodStyle("GET").label).toBe("GET");
  });
});
