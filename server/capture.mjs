import zlib from "node:zlib";

export const REDACTED = "«redacted»";

/**
 * Accumulates stream chunks up to a byte cap. Everything past the cap is
 * counted but discarded, so a 2 GB download can flow through the proxy
 * without the inspector holding it in memory.
 */
export function createCollector(maxBytes) {
  const chunks = [];
  let kept = 0;
  let total = 0;

  return {
    push(chunk) {
      total += chunk.length;
      if (kept >= maxBytes) return;
      const room = maxBytes - kept;
      if (chunk.length <= room) {
        chunks.push(chunk);
        kept += chunk.length;
      } else {
        chunks.push(chunk.subarray(0, room));
        kept = maxBytes;
      }
    },
    get size() {
      return total;
    },
    get truncated() {
      return total > kept;
    },
    buffer() {
      return Buffer.concat(chunks, kept);
    },
  };
}

/** Undo content-encoding so the captured body is readable. */
export function decompress(buffer, contentEncoding) {
  const encoding = String(contentEncoding ?? "").trim().toLowerCase();
  if (!encoding || encoding === "identity" || buffer.length === 0) return buffer;
  try {
    if (encoding === "gzip" || encoding === "x-gzip") return zlib.gunzipSync(buffer);
    if (encoding === "deflate") return zlib.inflateSync(buffer);
    if (encoding === "br") return zlib.brotliDecompressSync(buffer);
    if (encoding === "zstd" && typeof zlib.zstdDecompressSync === "function") {
      return zlib.zstdDecompressSync(buffer);
    }
  } catch {
    // Truncated or malformed payload — fall through and report the raw bytes.
  }
  return null;
}

const TEXTUAL_TYPES = [
  "application/json",
  "application/ld+json",
  "application/xml",
  "application/xhtml+xml",
  "application/javascript",
  "application/ecmascript",
  "application/graphql",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "image/svg+xml",
];

export function isTextualContentType(contentType) {
  const ct = String(contentType ?? "").toLowerCase();
  if (!ct) return true; // unknown: fall back to sniffing the bytes
  if (ct.startsWith("text/")) return true;
  if (/\+json\b|\+xml\b/.test(ct)) return true;
  return TEXTUAL_TYPES.some((t) => ct.includes(t));
}

/** A NUL byte in the first KB is a reliable "this isn't text" signal. */
export function looksBinary(buffer) {
  const limit = Math.min(buffer.length, 1024);
  for (let i = 0; i < limit; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function tryParseJson(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * Turn collected bytes into something the UI can render.
 * Returns { body, size, truncated, binary }.
 */
export function buildBody(collector, headers = {}) {
  const size = collector.size;
  if (size === 0) return { body: null, size: 0, truncated: false, binary: false };

  const raw = collector.buffer();
  const truncated = collector.truncated;
  const contentType = headers["content-type"];
  const decoded = truncated ? raw : decompress(raw, headers["content-encoding"]);

  if (decoded === null) {
    // Compressed payload we could not decode (usually because it was truncated).
    return { body: null, size, truncated, binary: true };
  }

  if (!isTextualContentType(contentType) || looksBinary(decoded)) {
    return { body: null, size, truncated, binary: true };
  }

  const text = decoded.toString("utf-8");
  return { body: tryParseJson(text), size, truncated, binary: false };
}

/**
 * Copy headers, replacing the value of any redacted name. Redaction happens
 * before the entry reaches the buffer, so secrets never enter the feed at all.
 */
export function redactHeaders(headers, redactList = []) {
  const out = {};
  const redacted = new Set(redactList.map((h) => h.toLowerCase()));
  for (const [key, value] of Object.entries(headers ?? {})) {
    out[key] = redacted.has(key.toLowerCase()) ? REDACTED : value;
  }
  return out;
}
