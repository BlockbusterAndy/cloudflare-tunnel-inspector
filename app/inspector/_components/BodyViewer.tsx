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

export function BodyViewer({ body, contentType, title = "Body" }: { body: unknown; contentType?: string; title?: string }) {
  if (body === null || body === undefined)
    return <p className="text-sm italic text-[#908fa0]">No body</p>;

  const format = detectFormat(body, contentType);
  const label = FORMAT_LABELS[format];
  const rawText = getRawText(body);
  const sizeStr = formatBytes(rawText.length);

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
