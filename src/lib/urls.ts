import "server-only";
import type { DocumentKind } from "@/db/schema";
import { env } from "@/lib/env";

export function documentPath(
  projectSlug: string,
  docSlug: string,
  kind: DocumentKind,
  v?: number,
): string {
  const params = new URLSearchParams();
  if (kind === "report") params.set("kind", "report");
  if (v !== undefined) params.set("v", String(v));
  const query = params.toString();
  return `/p/${projectSlug}/${docSlug}${query ? `?${query}` : ""}`;
}

export function absoluteUrl(path: string): string {
  return new URL(path, `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/`).toString();
}

export function appUrl(): string {
  return env.BETTER_AUTH_URL.replace(/\/$/, "");
}

export function shareUrl(token: string): string {
  return absoluteUrl(`/s/${token}`);
}
