import { defineConfig } from "drizzle-kit";
import { parseDatabaseUrl } from "./src/lib/env-schema";

const directUrl = parseDatabaseUrl(process.env.DIRECT_URL);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations must never fall back to the pooled runtime connection.
  dbCredentials: { url: directUrl },
});
