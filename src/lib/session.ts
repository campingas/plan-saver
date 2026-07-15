import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { isEmailAllowed } from "./env";

export function retainAllowedSession<T extends { user: { email: string } }>(session: T | null): T | null {
  return session && isEmailAllowed(session.user.email) ? session : null;
}

export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return retainAllowedSession(session);
});

export async function getSessionFromHeaders(requestHeaders: Headers) {
  const session = await auth.api.getSession({ headers: requestHeaders });
  return retainAllowedSession(session);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
