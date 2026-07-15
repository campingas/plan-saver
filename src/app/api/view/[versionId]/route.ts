import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/session";
import { logServerEvent } from "@/lib/log";
import { resolveViewerContent, viewerModeFromDownload, viewerResponse } from "@/lib/viewer";

// Archived documents are self-contained HTML that runs its own inline scripts
// (syntax highlighting), so they are served from this dedicated route and only
// ever embedded via <iframe sandbox="allow-scripts"> without allow-same-origin.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const startedAt = performance.now();
  const { versionId } = await params;

  const share = req.nextUrl.searchParams.get("share");
  const authMode = share ? "share" : "owner";
  const session = share ? null : await getSessionFromHeaders(req.headers);
  const content = await resolveViewerContent({
    versionId,
    shareToken: share ?? undefined,
    userId: session?.user.id,
  });
  const mode = viewerModeFromDownload(req.nextUrl.searchParams.get("download"));
  const response = viewerResponse(content, mode);
  logServerEvent({
    event: "viewer",
    outcome: response.ok ? "ok" : "not_found",
    status: response.status,
    authMode,
    durationMs: Math.round(performance.now() - startedAt),
  });
  return response;
}
