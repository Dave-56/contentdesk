"use client";

import { useState } from "react";

export function CopyPromptButton({ prompt }: { prompt: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("failed");
      window.setTimeout(() => setStatus("idle"), 2400);
    }
  }

  return (
    <button
      type="button"
      onClick={copyPrompt}
      aria-label="Copy Codex handoff prompt"
      style={{
        border: 0,
        borderRadius: 6,
        background: status === "copied" ? "#0f7a55" : "#25201a",
        color: "#ffffff",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 700,
        padding: "10px 14px",
      }}
    >
      {status === "copied"
        ? "Copied"
        : status === "failed"
          ? "Copy failed"
          : "Copy prompt"}
    </button>
  );
}
