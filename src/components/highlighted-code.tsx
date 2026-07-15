"use client";

import { HIGHLIGHT_THEME, highlightCode } from "@/lib/code-highlighting";

export function HighlightedCode({ code, language }: { code: string; language: string }) {
  const highlighted = highlightCode(code, language);

  return (
    <>
      <style>{HIGHLIGHT_THEME}</style>
      <pre className="overflow-x-auto border border-line bg-panel-2 p-4 font-mono text-xs leading-relaxed text-ink">
        <code
          className={`hljs language-${language}`}
          dangerouslySetInnerHTML={highlighted === null ? undefined : { __html: highlighted }}
        >
          {highlighted === null ? code : undefined}
        </code>
      </pre>
    </>
  );
}
