import "server-only";
import { load } from "cheerio";
import TurndownService from "turndown";
import { gfm } from "@truto/turndown-plugin-gfm";

const SAFE_LINK_SCHEMES = new Set(["http", "https", "mailto", "tel"]);
const SAFE_IMAGE_SCHEMES = new Set(["http", "https"]);
const SAFE_DATA_IMAGE = /^data:image\/(?:gif|jpe?g|png|webp);base64,/i;

function isSafeDestination(value: string, image: boolean): boolean {
  const destination = value.trim();
  if (!destination) return false;
  if (
    destination.startsWith("#") ||
    destination.startsWith("/") ||
    destination.startsWith("./") ||
    destination.startsWith("../")
  ) {
    return true;
  }
  const normalized = destination.replace(/[\u0000-\u0020\u007f]+/g, "");
  const scheme = normalized.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (!scheme) return true;
  return image
    ? SAFE_IMAGE_SCHEMES.has(scheme) || SAFE_DATA_IMAGE.test(normalized)
    : SAFE_LINK_SCHEMES.has(scheme);
}

function cleanAttribute(value: string | null): string {
  return value?.replace(/(\n+\s*)+/g, "\n") ?? "";
}

function escapeDestination(value: string): string {
  const escaped = value.replace(/([<>()])/g, "\\$1");
  return escaped.includes(" ") ? `<${escaped}>` : escaped;
}

function escapeTitle(value: string): string {
  return cleanAttribute(value).replace(/"/g, '\\"');
}

function createTurndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "_",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });
  service.use(gfm as TurndownService.Plugin);
  service.addRule("safeLinks", {
    filter: "a",
    replacement(content, node) {
      const href = cleanAttribute(node.getAttribute("href"));
      if (!isSafeDestination(href, false)) return content;
      const title = escapeTitle(node.getAttribute("title") ?? "");
      return `[${content}](${escapeDestination(href)}${title ? ` "${title}"` : ""})`;
    },
  });
  service.addRule("safeImages", {
    filter: "img",
    replacement(_content, node) {
      const alt = service.escape(cleanAttribute(node.getAttribute("alt")));
      const src = cleanAttribute(node.getAttribute("src"));
      if (!isSafeDestination(src, true)) return alt;
      const title = escapeTitle(node.getAttribute("title") ?? "");
      return `![${alt}](${escapeDestination(src)}${title ? ` "${title}"` : ""})`;
    },
  });
  return service;
}

export function htmlToMarkdown(html: string): string {
  const $ = load(html);
  $("head, script, style, noscript, template, iframe, object, embed").remove();
  const body = $("body").html() ?? $.root().html() ?? "";
  return `${createTurndownService().turndown(body).trimEnd()}\n`;
}
