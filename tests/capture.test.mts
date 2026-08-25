import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import {
  createCollector,
  decompress,
  isTextualContentType,
  looksBinary,
  buildBody,
  redactHeaders,
  REDACTED,
} from "../server/capture.mjs";

describe("createCollector", () => {
  it("keeps everything under the cap", () => {
    const collector = createCollector(1024);
    collector.push(Buffer.from("hello "));
    collector.push(Buffer.from("world"));
    expect(collector.buffer().toString()).toBe("hello world");
    expect(collector.size).toBe(11);
    expect(collector.truncated).toBe(false);
  });

  it("counts but discards bytes past the cap", () => {
    const collector = createCollector(5);
    collector.push(Buffer.from("abcdefghij"));
    collector.push(Buffer.from("klmno"));
    expect(collector.buffer().toString()).toBe("abcde");
    expect(collector.size).toBe(15);
    expect(collector.truncated).toBe(true);
  });
});

describe("decompress", () => {
  it("round-trips gzip, deflate and brotli", () => {
    const text = "the quick brown fox";
    expect(decompress(zlib.gzipSync(text), "gzip")?.toString()).toBe(text);
    expect(decompress(zlib.deflateSync(text), "deflate")?.toString()).toBe(text);
    expect(decompress(zlib.brotliCompressSync(text), "br")?.toString()).toBe(text);
  });

  it("passes identity and missing encodings through", () => {
    const buf = Buffer.from("plain");
    expect(decompress(buf, undefined)).toBe(buf);
    expect(decompress(buf, "identity")).toBe(buf);
  });

  it("returns null for undecodable payloads", () => {
    expect(decompress(Buffer.from("not gzip at all"), "gzip")).toBeNull();
  });
});

describe("content sniffing", () => {
  it("classifies textual content types", () => {
    expect(isTextualContentType("text/html; charset=utf-8")).toBe(true);
    expect(isTextualContentType("application/json")).toBe(true);
    expect(isTextualContentType("application/vnd.api+json")).toBe(true);
    expect(isTextualContentType("image/svg+xml")).toBe(true);
    expect(isTextualContentType("image/png")).toBe(false);
    expect(isTextualContentType("application/octet-stream")).toBe(false);
  });

  it("detects NUL bytes as binary", () => {
    expect(looksBinary(Buffer.from([0x41, 0x00, 0x42]))).toBe(true);
    expect(looksBinary(Buffer.from("just text"))).toBe(false);
  });
});

describe("buildBody", () => {
  function collect(buf: Buffer, max = 1024 * 1024) {
    const collector = createCollector(max);
    collector.push(buf);
    return collector;
  }

  it("returns a null body for empty payloads", () => {
    expect(buildBody(createCollector(1024), {})).toEqual({
      body: null,
      size: 0,
      truncated: false,
      binary: false,
    });
  });

  it("parses JSON and reports the wire size", () => {
    const result = buildBody(collect(Buffer.from('{"a":1}')), { "content-type": "application/json" });
    expect(result.body).toEqual({ a: 1 });
    expect(result.size).toBe(7);
    expect(result.binary).toBe(false);
  });

  it("decodes gzip before parsing", () => {
    const gz = zlib.gzipSync('{"ok":true}');
    const result = buildBody(collect(gz), {
      "content-type": "application/json",
      "content-encoding": "gzip",
    });
    expect(result.body).toEqual({ ok: true });
    expect(result.size).toBe(gz.length);
  });

  it("marks binary payloads instead of storing mojibake", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x00, 0x00]);
    const result = buildBody(collect(png), { "content-type": "image/png" });
    expect(result.binary).toBe(true);
    expect(result.body).toBeNull();
  });

  it("flags truncation and keeps the head of the body", () => {
    const result = buildBody(collect(Buffer.from("x".repeat(100)), 10), {
      "content-type": "text/plain",
    });
    expect(result.truncated).toBe(true);
    expect(result.size).toBe(100);
    expect(result.body).toBe("x".repeat(10));
  });
});

describe("redactHeaders", () => {
  it("replaces listed headers case-insensitively", () => {
    const headers = { Authorization: "Bearer secret", Cookie: "sid=1", host: "example.com" };
    expect(redactHeaders(headers, ["authorization", "cookie"])).toEqual({
      Authorization: REDACTED,
      Cookie: REDACTED,
      host: "example.com",
    });
  });

  it("passes headers through when nothing is redacted", () => {
    expect(redactHeaders({ a: "1" }, [])).toEqual({ a: "1" });
    expect(redactHeaders(undefined, ["a"])).toEqual({});
  });
});
