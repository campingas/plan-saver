"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  createApiTokenForUser,
  createShareLinkForUser,
  revokeApiTokenForUser,
  revokeShareLinkForUser,
} from "@/lib/mutations";
import { requireSession } from "@/lib/session";
import { shareUrl } from "@/lib/urls";

const idSchema = z.uuid();
const tokenNameSchema = z.string().trim().min(1, "Name is required.").max(100);

export async function createApiToken(
  _prev: { token: string | null; error: string | null },
  formData: FormData,
): Promise<{ token: string | null; error: string | null }> {
  const session = await requireSession();
  const parsedName = tokenNameSchema.safeParse(formData.get("name"));
  if (!parsedName.success) {
    return { token: null, error: parsedName.error.issues[0]?.message ?? "Invalid name." };
  }

  const token = await createApiTokenForUser(session.user.id, parsedName.data);
  refresh();
  return { token, error: null };
}

export async function revokeApiToken(id: string): Promise<void> {
  const session = await requireSession();
  const tokenId = idSchema.parse(id);
  await revokeApiTokenForUser(session.user.id, tokenId);
  refresh();
}

export async function createShareLink(
  versionId: string,
  _prev: { url: string | null; error: string | null },
): Promise<{ url: string | null; error: string | null }> {
  void _prev;
  const session = await requireSession();
  const ownedVersionId = idSchema.parse(versionId);
  const token = await createShareLinkForUser(session.user.id, ownedVersionId);
  if (!token) {
    return { url: null, error: "Version not found." };
  }
  refresh();
  return { url: shareUrl(token), error: null };
}

export async function revokeShareLink(id: string): Promise<void> {
  const session = await requireSession();
  const shareLinkId = idSchema.parse(id);
  await revokeShareLinkForUser(session.user.id, shareLinkId);
  refresh();
}
