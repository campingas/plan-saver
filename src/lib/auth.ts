import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "@/db";
import * as schema from "@/db/schema";

const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (!allowedEmails.includes(email.toLowerCase())) {
          throw new APIError("FORBIDDEN", {
            message: "This email is not allowed to sign in.",
          });
        }
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.MAGIC_LINK_FROM ?? "Plan-Saver <onboarding@resend.dev>",
          to: email,
          subject: "Your Plan-Saver sign-in link",
          html: `<p><a href="${url}">Sign in to Plan-Saver</a></p><p>This link expires shortly. If you didn't request it, ignore this email.</p>`,
        });
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
