import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { document, shareLink, version } from "@/db/schema";
import { auth } from "@/lib/auth";

// Archived documents are self-contained HTML that runs its own inline scripts
// (syntax highlighting), so they are served from this dedicated route and only
// ever embedded via <iframe sandbox="allow-scripts"> without allow-same-origin.
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "frame-ancestors 'self'",
].join("; ");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;

  const [row] = await db
    .select({
      html: version.html,
      number: version.number,
      slug: document.slug,
      ownerId: document.userId,
    })
    .from(version)
    .innerJoin(document, eq(version.documentId, document.id))
    .where(eq(version.id, versionId))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const share = req.nextUrl.searchParams.get("share");
  if (share) {
    const [link] = await db
      .select({ id: shareLink.id })
      .from(shareLink)
      .where(
        and(
          eq(shareLink.token, share),
          eq(shareLink.versionId, versionId),
          isNull(shareLink.revokedAt),
        ),
      )
      .limit(1);
    if (!link) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  } else {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session || session.user.id !== row.ownerId) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": CSP,
    "X-Robots-Tag": "noindex",
    "Cache-Control": "private, no-store",
  };
  if (req.nextUrl.searchParams.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="${row.slug}-v${row.number}.html"`;
  }
  return new NextResponse(row.html, { headers });
}
