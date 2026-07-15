import "server-only";
import { and, asc, count, desc, eq, isNull, max, sql } from "drizzle-orm";
import { db } from "./index";
import {
  apiToken,
  document,
  project,
  shareLink,
  version,
  type DocumentKind,
} from "./schema";
import { hashToken } from "@/lib/tokens";

export async function getProjectForUser(userId: string, slug: string) {
  const [row] = await db
    .select()
    .from(project)
    .where(and(eq(project.userId, userId), eq(project.slug, slug)))
    .limit(1);
  return row ?? null;
}

export async function getProjectByIdForUser(userId: string, projectId: string) {
  const [row] = await db
    .select()
    .from(project)
    .where(and(eq(project.userId, userId), eq(project.id, projectId)))
    .limit(1);
  return row ?? null;
}

export function listProjectsWithStats(userId: string) {
  return db
    .select({
      slug: project.slug,
      displayName: project.displayName,
      docCount: count(document.id),
      lastActivity: max(document.updatedAt),
    })
    .from(project)
    .leftJoin(document, eq(document.projectId, project.id))
    .where(eq(project.userId, userId))
    .groupBy(project.id)
    .orderBy(desc(max(document.updatedAt)));
}

export function listProjectDocuments(userId: string, projectId: string) {
  return db
    .select({
      slug: document.slug,
      kind: document.kind,
      title: document.title,
      updatedAt: document.updatedAt,
      versionCount: count(version.id),
      agent: sql<string | null>`(array_agg(${version.meta}->>'agent' order by ${version.number} desc))[1]`,
    })
    .from(document)
    .innerJoin(project, eq(document.projectId, project.id))
    .leftJoin(version, eq(version.documentId, document.id))
    .where(and(eq(project.userId, userId), eq(project.id, projectId)))
    .groupBy(document.id)
    .orderBy(desc(document.updatedAt));
}

// At most one plan and one report share a slug. Prefer the requested kind,
// then fall back to whichever kind exists.
export async function findDocument(
  userId: string,
  projectId: string,
  slug: string,
  preferred: DocumentKind,
) {
  const rows = await db
    .select({ document })
    .from(document)
    .innerJoin(project, eq(document.projectId, project.id))
    .where(
      and(
        eq(project.userId, userId),
        eq(project.id, projectId),
        eq(document.slug, slug),
      ),
    )
    .orderBy(asc(document.kind));
  const documents = rows.map((row) => row.document);
  return documents.find((row) => row.kind === preferred) ?? documents[0] ?? null;
}

export function listVersions(userId: string, documentId: string) {
  return db
    .select({
      id: version.id,
      number: version.number,
      title: version.title,
      createdAt: version.createdAt,
    })
    .from(version)
    .innerJoin(document, eq(version.documentId, document.id))
    .innerJoin(project, eq(document.projectId, project.id))
    .where(and(eq(project.userId, userId), eq(document.id, documentId)))
    .orderBy(desc(version.number));
}

export async function getOwnedVersionForViewer(versionId: string, userId: string) {
  const [row] = await db
    .select({
      number: version.number,
      slug: document.slug,
      agent: sql<string | null>`${version.meta}->>'agent'`,
    })
    .from(version)
    .innerJoin(document, eq(version.documentId, document.id))
    .innerJoin(project, eq(document.projectId, project.id))
    .where(and(eq(version.id, versionId), eq(project.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getSharedVersionForViewer(token: string, versionId: string) {
  const [row] = await db
    .select({
      number: version.number,
      slug: document.slug,
      agent: sql<string | null>`${version.meta}->>'agent'`,
    })
    .from(shareLink)
    .innerJoin(version, eq(shareLink.versionId, version.id))
    .innerJoin(document, eq(version.documentId, document.id))
    .where(
      and(
        eq(shareLink.tokenHash, hashToken(token)),
        eq(version.id, versionId),
        isNull(shareLink.revokedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getOwnedVersionHtml(versionId: string, userId: string) {
  const [row] = await db
    .select({ html: version.html })
    .from(version)
    .innerJoin(document, eq(version.documentId, document.id))
    .innerJoin(project, eq(document.projectId, project.id))
    .where(and(eq(version.id, versionId), eq(project.userId, userId)))
    .limit(1);
  return row?.html ?? null;
}

export async function getSharedVersionHtml(versionId: string, token: string) {
  const [row] = await db
    .select({ html: version.html })
    .from(shareLink)
    .innerJoin(version, eq(shareLink.versionId, version.id))
    .where(
      and(
        eq(version.id, versionId),
        eq(shareLink.tokenHash, hashToken(token)),
        isNull(shareLink.revokedAt),
      ),
    )
    .limit(1);
  return row?.html ?? null;
}

export async function isVersionOwned(versionId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: version.id })
    .from(version)
    .innerJoin(document, eq(version.documentId, document.id))
    .innerJoin(project, eq(document.projectId, project.id))
    .where(and(eq(version.id, versionId), eq(project.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export async function isShareLinkOwned(shareLinkId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: shareLink.id })
    .from(shareLink)
    .innerJoin(version, eq(shareLink.versionId, version.id))
    .innerJoin(document, eq(version.documentId, document.id))
    .innerJoin(project, eq(document.projectId, project.id))
    .where(and(eq(shareLink.id, shareLinkId), eq(project.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export function listActiveShareLinks(userId: string, versionId: string) {
  return db
    .select({ id: shareLink.id, createdAt: shareLink.createdAt })
    .from(shareLink)
    .innerJoin(version, eq(shareLink.versionId, version.id))
    .innerJoin(document, eq(version.documentId, document.id))
    .innerJoin(project, eq(document.projectId, project.id))
    .where(
      and(
        eq(project.userId, userId),
        eq(shareLink.versionId, versionId),
        isNull(shareLink.revokedAt),
      ),
    )
    .orderBy(desc(shareLink.createdAt));
}

export async function getSharedVersion(token: string) {
  const [row] = await db
    .select({
      versionId: version.id,
      number: version.number,
      title: version.title,
      kind: document.kind,
    })
    .from(shareLink)
    .innerJoin(version, eq(shareLink.versionId, version.id))
    .innerJoin(document, eq(version.documentId, document.id))
    .where(and(eq(shareLink.tokenHash, hashToken(token)), isNull(shareLink.revokedAt)))
    .limit(1);
  return row ?? null;
}

export function listUserTokens(userId: string) {
  return db
    .select()
    .from(apiToken)
    .where(eq(apiToken.userId, userId))
    .orderBy(desc(apiToken.createdAt));
}
