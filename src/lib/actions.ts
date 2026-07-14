"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { apiToken, document, shareLink, version } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { generateApiToken, generateShareToken } from "@/lib/tokens";

export async function createApiToken(
  _prev: { token: string | null; error: string | null },
  formData: FormData,
): Promise<{ token: string | null; error: string | null }> {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { token: null, error: "Name is required." };

  const { token, hash } = generateApiToken();
  await db.insert(apiToken).values({ userId: session.user.id, name, tokenHash: hash });
  revalidatePath("/settings/tokens");
  return { token, error: null };
}

export async function revokeApiToken(id: string): Promise<void> {
  const session = await requireSession();
  await db
    .update(apiToken)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiToken.id, id), eq(apiToken.userId, session.user.id)));
  revalidatePath("/settings/tokens");
}

async function assertVersionOwned(versionId: string, userId: string) {
  const [row] = await db
    .select({ id: version.id })
    .from(version)
    .innerJoin(document, eq(version.documentId, document.id))
    .where(and(eq(version.id, versionId), eq(document.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Version not found");
}

export async function createShareLink(versionId: string): Promise<void> {
  const session = await requireSession();
  await assertVersionOwned(versionId, session.user.id);
  await db.insert(shareLink).values({ versionId, token: generateShareToken() });
  revalidatePath("/p", "layout");
}

export async function revokeShareLink(id: string): Promise<void> {
  const session = await requireSession();
  const [row] = await db
    .select({ id: shareLink.id })
    .from(shareLink)
    .innerJoin(version, eq(shareLink.versionId, version.id))
    .innerJoin(document, eq(version.documentId, document.id))
    .where(and(eq(shareLink.id, id), eq(document.userId, session.user.id)))
    .limit(1);
  if (!row) throw new Error("Share link not found");
  await db.update(shareLink).set({ revokedAt: new Date() }).where(eq(shareLink.id, id));
  revalidatePath("/p", "layout");
}
