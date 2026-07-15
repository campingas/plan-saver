"use client";

import { useState } from "react";

export function CopySnippet({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (permissions, http): leave the text selectable
    }
  }

  return (
    <div className="flex items-stretch border border-line-strong bg-panel">
      <code className="flex-1 overflow-x-auto whitespace-nowrap px-4 py-3 font-mono text-sm text-accent">
        {command}
      </code>
      <button
        onClick={copy}
        className="btn btn-ghost shrink-0 border-y-0 border-r-0 border-l border-line-strong"
        aria-label="Copy command"
      >
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
