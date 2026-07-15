import "server-only";
import { load } from "cheerio";
import { HIGHLIGHT_THEME, highlightCode } from "@/lib/code-highlighting";

const THEME_MARKER = "data-plan-saver-highlighting";
const MAX_DOCUMENT_HIGHLIGHT_CHARS = 250_000;

function languageFrom(className: string | undefined): string | undefined {
  return className
    ?.split(/\s+/)
    .find((name) => name.startsWith("language-"))
    ?.slice("language-".length);
}

export function highlightDocumentHtml(html: string): string {
  if (!/<pre[\s>]/i.test(html) || !/<code[\s>]/i.test(html)) return html;

  try {
    const $ = load(html, null, false);
    let changed = false;
    let remainingChars = MAX_DOCUMENT_HIGHLIGHT_CHARS;

    $("pre > code").each((_index, element) => {
      const code = $(element);
      if (code.hasClass("hljs") || code.find('[class^="hljs-"]').length > 0) return;

      const source = code.text();
      if (source.length > remainingChars) return;
      remainingChars -= source.length;

      const highlighted = highlightCode(source, languageFrom(code.attr("class")));
      if (highlighted === null) return;

      code.html(highlighted).addClass("hljs");
      changed = true;
    });

    if (!changed) return html;

    const style = `<style ${THEME_MARKER}>${HIGHLIGHT_THEME}</style>`;
    const head = $("head");
    if (head.length > 0) head.append(style);
    else $.root().prepend(style);
    return $.html();
  } catch {
    return html;
  }
}
