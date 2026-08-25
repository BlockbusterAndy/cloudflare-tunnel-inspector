"use client";

import { detectFormat, FORMAT_LABELS, formatBytes, getRawText, tryParseJson } from "./helpers";
import { CopyButton } from "./CopyButton";
import { CodeBlock } from "./CodeBlock";
import {
  JsonValue,
  MarkupHighlighter,
  JsHighlighter,
  GraphqlHighlighter,
  GraphqlJsonViewer,
  FormDataViewer,
  MultipartViewer,
} from "./SyntaxHighlighters";

export function BodyViewer({
  body,
  contentType,
  title = "Body",
  size,
  binary = false,
  truncated = false,
}: {
  body: unknown;
  contentType?: string;
  title?: string;
  /** Wire size in bytes, from the proxy. Falls back to the rendered length. */
  size?: number;
  /** Body was non-text (image, archive, …) and deliberately not captured. */
  binary?: boolean;
  /** Body exceeded the capture cap; what is shown is the head of it. */
  truncated?: boolean;
}) {
  if (binary) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold text-[#908fa0] uppercase tracking-[0.05em]">{title}</span>
          <span className="text-[10px] font-mono text-[#908fa0]/60">{formatBytes(size)}</span>
        </div>
        <div className="rounded-sm bg-[#0e0e10] px-4 py-6 text-center">
          <p className="text-sm text-[#908fa0]">Binary body not captured</p>
          <p className="text-[11px] text-[#908fa0]/50 mt-1 font-mono">
            {contentType ?? "unknown content type"} · {formatBytes(size)}
          </p>
        </div>
      </div>
    );
  }

  if (body === null || body === undefined)
    return <p className="text-sm italic text-[#908fa0]">No body</p>;

  const format = detectFormat(body, contentType);
  const label = FORMAT_LABELS[format];
  const rawText = getRawText(body);
  const sizeStr = formatBytes(size ?? rawText.length);

  if (truncated) {
    return (
      <div>
        <div className="mb-2 rounded-sm bg-[#f59e0b]/10 px-3 py-2 text-[11px] text-[#f59e0b]">
          Truncated — showing the first {formatBytes(rawText.length)} of {sizeStr}. Raise the cap with{" "}
          <code className="font-mono">--max-body-bytes</code>.
        </div>
        <BodyViewer body={body} contentType={contentType} title={title} size={rawText.length} />
      </div>
    );
  }

  // GraphQL-over-JSON
  if (format === "graphql-json") {
    const obj = typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : tryParseJson(String(body)) as Record<string, unknown> | null;
    if (obj) {
      return (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-[#908fa0] uppercase tracking-[0.05em]">{title}</span>
            <CopyButton text={rawText} />
          </div>
          <GraphqlJsonViewer body={obj} />
        </div>
      );
    }
  }

  // JSON (object already parsed)
  if (format === "json" && typeof body === "object") {
    return (
      <CodeBlock rawText={rawText} label={label} size={sizeStr}>
        <JsonValue value={body} />
      </CodeBlock>
    );
  }

  const text = String(body);

  // JSON (string that needs parsing)
  if (format === "json") {
    const parsed = tryParseJson(text);
    if (parsed !== null) {
      const prettyJson = JSON.stringify(parsed, null, 2);
      return (
        <CodeBlock rawText={prettyJson} label={label} size={sizeStr}>
          <JsonValue value={parsed} />
        </CodeBlock>
      );
    }
  }

  // Form data
  if (format === "form-data") {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono text-[#908fa0]">{label}</span>
          <CopyButton text={text} />
        </div>
        <div className="rounded-sm bg-[#0e0e10] p-4">
          <FormDataViewer text={text} />
        </div>
      </div>
    );
  }

  // Multipart
  if (format === "multipart") {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono text-[#908fa0]">{label}</span>
          <CopyButton text={text} />
        </div>
        <div className="rounded-sm bg-[#0e0e10] p-4">
          <MultipartViewer text={text} />
        </div>
      </div>
    );
  }

  // HTML / XML with syntax highlighting
  if (format === "html" || format === "xml") {
    return (
      <CodeBlock rawText={text} label={label} size={sizeStr}>
        <MarkupHighlighter text={text} />
      </CodeBlock>
    );
  }

  // JavaScript
  if (format === "javascript") {
    return (
      <CodeBlock rawText={text} label={label} size={sizeStr}>
        <JsHighlighter text={text} />
      </CodeBlock>
    );
  }

  // GraphQL
  if (format === "graphql") {
    return (
      <CodeBlock rawText={text} label={label} size={sizeStr}>
        <GraphqlHighlighter text={text} />
      </CodeBlock>
    );
  }

  // Plain text fallback
  return (
    <CodeBlock rawText={text} label={label} size={sizeStr}>
      {text}
    </CodeBlock>
  );
}
