"use client";

import { useMemo, useState } from "react";
import { CopyPromptButton } from "./copy-prompt-button";

const previewLength = 1800;

export function PromptViewer({ prompt }: { prompt: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = useMemo(() => {
    if (prompt.length <= previewLength) return prompt;

    const splitAt = Math.max(
      prompt.lastIndexOf("\n\n", previewLength),
      prompt.lastIndexOf("\n", previewLength),
    );
    const end = splitAt > previewLength * 0.6 ? splitAt : previewLength;

    return `${prompt.slice(0, end).trimEnd()}\n\n...`;
  }, [prompt]);
  const visiblePrompt = expanded ? prompt : preview;
  const canExpand = prompt.length > preview.length;

  return (
    <section style={{ padding: "26px 32px 34px" }}>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Prompt</h2>
          <p
            style={{
              color: "#697586",
              fontSize: 14,
              lineHeight: 1.45,
              margin: 0,
            }}
          >
            {expanded
              ? "Full handoff prompt"
              : "Preview of the handoff prompt"}
          </p>
        </div>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <span
            style={{
              color: "#697586",
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              fontSize: 12,
            }}
          >
            {prompt.length.toLocaleString()} chars
          </span>
          <CopyPromptButton prompt={prompt} />
        </div>
      </div>

      <div
        role={canExpand && !expanded ? "button" : undefined}
        tabIndex={canExpand && !expanded ? 0 : undefined}
        onClick={() => {
          if (canExpand && !expanded) setExpanded(true);
        }}
        onKeyDown={(event) => {
          if (!canExpand || expanded) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded(true);
          }
        }}
        aria-label={expanded ? "Full Codex handoff prompt" : "View full prompt"}
        style={{
          background: "#f1eee8",
          border: "1px solid #d9d2c8",
          borderRadius: 8,
          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.6)",
          color: "#25201a",
          cursor: canExpand && !expanded ? "pointer" : "default",
          display: "block",
          margin: 0,
          padding: 0,
          position: "relative",
          textAlign: "left",
          width: "100%",
        }}
      >
        <pre
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: 14,
            lineHeight: 1.65,
            margin: 0,
            maxHeight: expanded ? "none" : 520,
            overflow: "hidden",
            padding: 22,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <code>{visiblePrompt}</code>
        </pre>

        {canExpand && !expanded ? (
          <div
            style={{
              alignItems: "end",
              background:
                "linear-gradient(180deg, rgba(241, 238, 232, 0), #f1eee8 66%)",
              borderRadius: "0 0 8px 8px",
              bottom: 0,
              display: "flex",
              justifyContent: "center",
              left: 0,
              padding: "80px 20px 22px",
              pointerEvents: "none",
              position: "absolute",
              right: 0,
            }}
          >
            <span
              style={{
                background: "#25201a",
                borderRadius: 6,
                color: "#ffffff",
                display: "inline-block",
                fontSize: 14,
                fontWeight: 800,
                padding: "10px 14px",
              }}
            >
              View full prompt
            </span>
          </div>
        ) : null}
      </div>

      {canExpand && expanded ? (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            style={{
              background: "transparent",
              border: "1px solid #d9d2c8",
              borderRadius: 6,
              color: "#25201a",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
              padding: "9px 12px",
            }}
          >
            Collapse to preview
          </button>
        </div>
      ) : null}
    </section>
  );
}
