import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // migrations use the session pooler (DIRECT_URL); runtime uses the transaction pooler
  dbCredentials: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL! },
});
