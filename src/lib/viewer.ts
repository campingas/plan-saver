import "server-only";
import {
  getOwnedVersionForViewer,
  getOwnedVersionHtml,
  getSharedVersionForViewer,
  getSharedVersionHtml,
} from "@/db/queries";

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
    return html === null ? null : { ...authorized, html };
  }
  if (!input.userId) return null;
  const authorized = await getOwnedVersionForViewer(input.versionId, input.userId);
  if (!authorized) return null;
  const html = await getOwnedVersionHtml(input.versionId, input.userId);
  return html === null ? null : { ...authorized, html };
}

export function viewerResponse(
  content: { number: number; slug: string; html: string } | null,
  download: boolean,
): Response {
  if (!content) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": CSP,
    "X-Robots-Tag": "noindex",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "private, no-store",
  };
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${content.slug}-v${content.number}.html"`;
  }
  return new Response(content.html, { headers });
}
