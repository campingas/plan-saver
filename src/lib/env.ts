import "server-only";
import { parseEnv } from "@/lib/env-schema";

export const env = parseEnv({
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  MAGIC_LINK_FROM: process.env.MAGIC_LINK_FROM,
  ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
});

export const allowedEmails = new Set(env.ALLOWED_EMAILS);

export function isEmailAllowed(email: string): boolean {
  return allowedEmails.has(email.toLowerCase());
}
