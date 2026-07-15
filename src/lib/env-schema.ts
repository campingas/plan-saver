import { z } from "zod";

const emailList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(z.array(z.email()).min(1));

export const databaseUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "postgres:" || protocol === "postgresql:";
}, "must use the postgres or postgresql protocol");

const appUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname));
}, "must use HTTPS unless the host is localhost");

export const envSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  BETTER_AUTH_SECRET: z.string().trim().min(32, "must be at least 32 characters"),
  BETTER_AUTH_URL: appUrl,
  RESEND_API_KEY: z.string().trim().min(1),
  MAGIC_LINK_FROM: z.string().trim().min(1).default("Plan-Saver <onboarding@resend.dev>"),
  ALLOWED_EMAILS: emailList,
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): AppEnv {
  return envSchema.parse(source);
}

export function parseDatabaseUrl(value: string | undefined): string {
  return databaseUrlSchema.parse(value);
}
