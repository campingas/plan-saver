import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env, isEmailAllowed } from "@/lib/env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  rateLimit: {
    enabled: true,
    storage: "database",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 5,
      storeToken: "hashed",
      sendMagicLink: async ({ email, url }) => {
        // Better Auth has already prepared its generic success response. Do
        // not reveal whether a submitted address is on the allowlist.
        if (!isEmailAllowed(email)) return;

        const startedAt = performance.now();
        try {
          const resend = new Resend(env.RESEND_API_KEY);
          const { error } = await resend.emails.send({
            from: env.MAGIC_LINK_FROM,
            to: email,
            subject: "Your Plan-Saver sign-in link",
            html: `<p><a href="${url}">Sign in to Plan-Saver</a></p><p>This link expires in five minutes. If you didn't request it, ignore this email.</p>`,
          });
          if (error) throw new Error("Resend rejected the magic-link email");
          const { logServerEvent } = await import("@/lib/log");
          logServerEvent({ event: "auth_email", outcome: "ok", durationMs: Math.round(performance.now() - startedAt) });
        } catch (error) {
          const { logServerEvent } = await import("@/lib/log");
          logServerEvent({ event: "auth_email", outcome: "failed", durationMs: Math.round(performance.now() - startedAt) });
          throw error;
        }
      },
    }),
    // requireSession also runs inside server actions; this preserves any
    // session-refresh Set-Cookie headers produced in that context.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
