import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { isShareLinkOwned, isVersionOwned } from "@/db/queries";
import { apiToken, document, project, shareLink, version } from "@/db/schema";
import { generateApiToken, generateShareToken, hashToken } from "@/lib/tokens";

export async function createApiTokenForUser(userId: string, name: string) {
  const generated = generateApiToken();
  await db.insert(apiToken).values({ userId, name, tokenHash: generated.hash });
  return generated.token;
}

export async function revokeApiTokenForUser(userId: string, tokenId: string): Promise<boolean> {
  const rows = await db
    .update(apiToken)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiToken.id, tokenId), eq(apiToken.userId, userId)))
    .returning({ id: apiToken.id });
  return rows.length === 1;
}

export async function createShareLinkForUser(
  userId: string,
  versionId: string,
): Promise<string | null> {
  if (!(await isVersionOwned(versionId, userId))) return null;
  const token = generateShareToken();
  await db.insert(shareLink).values({ versionId, tokenHash: hashToken(token) });
  return token;
}

export async function revokeShareLinkForUser(userId: string, shareLinkId: string): Promise<boolean> {
  if (!(await isShareLinkOwned(shareLinkId, userId))) throw new Error("Share link not found");
  const rows = await db
    .update(shareLink)
    .set({ revokedAt: new Date() })
    .where(eq(shareLink.id, shareLinkId))
    .returning({ id: shareLink.id });
  return rows.length === 1;
}

export async function deleteVersionForUser(
  userId: string,
  versionId: string,
): Promise<{ projectSlug: string; documentDeleted: boolean } | null> {
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ documentId: version.documentId, projectSlug: project.slug })
      .from(version)
      .innerJoin(document, eq(version.documentId, document.id))
      .innerJoin(project, eq(document.projectId, project.id))
      .where(and(eq(version.id, versionId), eq(project.userId, userId)))
      .limit(1);
    if (!owned) return null;

    // Same document lock the ingest allocator takes, so a concurrent upload
    // cannot append to a document while its last version is being removed.
    await tx.execute(
      sql`select ${document.id} from ${document} where ${document.id} = ${owned.documentId} for update`,
    );
    await tx.delete(version).where(eq(version.id, versionId));
    const [{ remaining }] = await tx
      .select({ remaining: count(version.id) })
      .from(version)
      .where(eq(version.documentId, owned.documentId));
    if (remaining === 0) {
      await tx.delete(document).where(eq(document.id, owned.documentId));
    }
    return { projectSlug: owned.projectSlug, documentDeleted: remaining === 0 };
  });
}

export async function deleteDocumentForUser(
  userId: string,
  documentId: string,
): Promise<{ projectSlug: string } | null> {
  const [owned] = await db
    .select({ projectSlug: project.slug })
    .from(document)
    .innerJoin(project, eq(document.projectId, project.id))
    .where(and(eq(document.id, documentId), eq(project.userId, userId)))
    .limit(1);
  if (!owned) return null;
  await db.delete(document).where(eq(document.id, documentId));
  return { projectSlug: owned.projectSlug };
}

export async function deleteProjectForUser(userId: string, projectId: string): Promise<boolean> {
  const rows = await db
    .delete(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .returning({ id: project.id });
  return rows.length === 1;
}
