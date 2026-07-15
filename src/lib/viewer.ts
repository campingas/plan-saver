import "server-only";
import {
  getOwnedVersionForViewer,
  getOwnedVersionHtml,
  getSharedVersionForViewer,
  getSharedVersionHtml,
} from "@/db/queries";
import { highlightDocumentHtml } from "@/lib/document-highlighting";
import { displayAgentName } from "@/lib/agent";
import { htmlToMarkdown } from "@/lib/html-to-markdown";

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "frame-ancestors 'self'",
].join("; ");

export async function resolveViewerContent(input: {
  versionId: string;
  userId?: string;
  shareToken?: string;
}) {
  if (input.shareToken) {
    const authorized = await getSharedVersionForViewer(input.shareToken, input.versionId);
    if (!authorized) return null;
    const html = await getSharedVersionHtml(input.versionId, input.shareToken);
    return html === null ? null : { ...authorized, agent: displayAgentName(authorized.agent), html };
  }
  if (!input.userId) return null;
  const authorized = await getOwnedVersionForViewer(input.versionId, input.userId);
  if (!authorized) return null;
  const html = await getOwnedVersionHtml(input.versionId, input.userId);
  return html === null ? null : { ...authorized, agent: displayAgentName(authorized.agent), html };
}

export type ViewerMode = "display" | "html" | "markdown";

export function viewerModeFromDownload(download: string | null): ViewerMode {
  if (download === "1") return "html";
  if (download === "markdown") return "markdown";
  return "display";
}

export function viewerResponse(
  content: { number: number; slug: string; agent?: string | null; html: string } | null,
  mode: ViewerMode,
): Response {
  if (!content) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type":
      mode === "markdown" ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8",
    "Content-Security-Policy": CSP,
    "X-Robots-Tag": "noindex",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "private, no-store",
  };
  if (mode === "html") {
    headers["Content-Disposition"] = `attachment; filename="${content.slug}-v${content.number}.html"`;
  } else if (mode === "markdown") {
    headers["Content-Disposition"] = `attachment; filename="${content.slug}-v${content.number}.md"`;
  }
  return new Response(
    mode === "html"
      ? content.html
      : mode === "markdown"
        ? htmlToMarkdown(content.html)
        : highlightDocumentHtml(content.html, content.agent ?? null),
    { headers },
  );
}
