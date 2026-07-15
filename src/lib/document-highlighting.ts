import "server-only";
import { load } from "cheerio";
import { HIGHLIGHT_THEME, highlightCode } from "@/lib/code-highlighting";
import { displayAgentName } from "@/lib/agent";

const THEME_MARKER = "data-plan-saver-highlighting";
const AGENT_MARKER = "data-plan-saver-agent";
const FOOTER_MARKER = "data-plan-saver-footer";
const MAX_DOCUMENT_HIGHLIGHT_CHARS = 250_000;

function languageFrom(className: string | undefined): string | undefined {
  return className
    ?.split(/\s+/)
    .find((name) => name.startsWith("language-"))
    ?.slice("language-".length);
}

export function highlightDocumentHtml(html: string, agent?: unknown): string {
  const hasCode = /<pre[\s>]/i.test(html) && /<code[\s>]/i.test(html);
  if (!hasCode && agent === undefined) return html;
  try {
    const $ = load(html, null, false);
    let changed = false;
    let highlightedCode = false;
    let remainingChars = MAX_DOCUMENT_HIGHLIGHT_CHARS;

    if (hasCode) {
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
        highlightedCode = true;
      });
    }

    if (agent !== undefined) {
      const agentName = displayAgentName(agent);
      const markedAgent = $(`[${AGENT_MARKER}]`).first();
      if (markedAgent.length > 0) {
        markedAgent.text(agentName);
      } else {
        const agentSpan = $("<span>").attr(AGENT_MARKER, "").text(agentName);
        const footer = $("footer").last();
        if (footer.length > 0) {
          footer.append(" · Agent: ", agentSpan);
        } else {
          const fallbackFooter = $("<footer>")
            .attr(FOOTER_MARKER, "")
            .attr(
              "style",
              "margin:3rem auto 1rem;padding:1rem;max-width:920px;color:#8f969e;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace",
            )
            .append("Agent: ", agentSpan);
          const body = $("body");
          if (body.length > 0) body.append(fallbackFooter);
          else $.root().append(fallbackFooter);
        }
      }
      changed = true;
    }

    if (!changed) return html;

    if (highlightedCode) {
      const style = `<style ${THEME_MARKER}>${HIGHLIGHT_THEME}</style>`;
      const head = $("head");
      if (head.length > 0) head.append(style);
      else $.root().prepend(style);
    }
    return $.html();
  } catch {
    return html;
  }
}
