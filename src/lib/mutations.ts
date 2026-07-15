import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { isShareLinkOwned, isVersionOwned } from "@/db/queries";
import { apiToken, shareLink } from "@/db/schema";
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
