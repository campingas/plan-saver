import { and, eq, isNull, max } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { apiToken, document, project, version } from "@/db/schema";
import { hashToken } from "@/lib/tokens";

const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const bodySchema = z.object({
  project: z.string().min(1).max(100).regex(kebab, "must be kebab-case"),
  slug: z.string().min(1).max(150).regex(kebab, "must be kebab-case"),
  kind: z.enum(["plan", "report"]),
  title: z.string().min(1).max(300),
  html: z.string().min(1).max(2 * 1024 * 1024, "html exceeds 2 MB"),
  meta: z.record(z.string(), z.unknown()).optional(),
});

async function authenticate(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const tokenHash = hashToken(header.slice("Bearer ".length).trim());
  const [row] = await db
    .select({ id: apiToken.id, userId: apiToken.userId })
    .from(apiToken)
    .where(and(eq(apiToken.tokenHash, tokenHash), isNull(apiToken.revokedAt)))
    .limit(1);
  if (!row) return null;
  await db.update(apiToken).set({ lastUsedAt: new Date() }).where(eq(apiToken.id, row.id));
  return row.userId;
}

export async function POST(req: NextRequest) {
  const userId = await authenticate(req);
  if (!userId) {
    return NextResponse.json({ error: "invalid or revoked token" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  let [proj] = await db
    .select()
    .from(project)
    .where(and(eq(project.userId, userId), eq(project.slug, body.project)))
    .limit(1);
  if (!proj) {
    [proj] = await db
      .insert(project)
      .values({ userId, slug: body.project, displayName: body.project })
      .onConflictDoNothing()
      .returning();
    if (!proj) {
      [proj] = await db
        .select()
        .from(project)
        .where(and(eq(project.userId, userId), eq(project.slug, body.project)))
        .limit(1);
    }
  }

  let [doc] = await db
    .select()
    .from(document)
    .where(
      and(
        eq(document.projectId, proj.id),
        eq(document.slug, body.slug),
        eq(document.kind, body.kind),
      ),
    )
    .limit(1);
  if (!doc) {
    [doc] = await db
      .insert(document)
      .values({
        userId,
        projectId: proj.id,
        slug: body.slug,
        kind: body.kind,
        title: body.title,
      })
      .onConflictDoNothing()
      .returning();
    if (!doc) {
      [doc] = await db
        .select()
        .from(document)
        .where(
          and(
            eq(document.projectId, proj.id),
            eq(document.slug, body.slug),
            eq(document.kind, body.kind),
          ),
        )
        .limit(1);
    }
  } else {
    await db
      .update(document)
      .set({ title: body.title, updatedAt: new Date() })
      .where(eq(document.id, doc.id));
  }

  // Concurrent uploads to the same document can race on the version number;
  // the unique index catches it and we recompute.
  let inserted;
  for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
    const [{ current }] = await db
      .select({ current: max(version.number) })
      .from(version)
      .where(eq(version.documentId, doc.id));
    [inserted] = await db
      .insert(version)
      .values({
        documentId: doc.id,
        number: (current ?? 0) + 1,
        title: body.title,
        html: body.html,
        meta: body.meta,
      })
      .onConflictDoNothing()
      .returning({ number: version.number });
  }
  if (!inserted) {
    return NextResponse.json({ error: "could not allocate version number" }, { status: 500 });
  }

  const base = process.env.BETTER_AUTH_URL ?? req.nextUrl.origin;
  const kindParam = body.kind === "report" ? "?kind=report" : "";
  return NextResponse.json(
    {
      url: `${base}/p/${proj.slug}/${doc.slug}${kindParam}`,
      version: inserted.number,
    },
    { status: 201 },
  );
}
