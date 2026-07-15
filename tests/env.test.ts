import { describe, expect, test } from "bun:test";
import { parseDatabaseUrl, parseEnv } from "@/lib/env-schema";

const valid = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/plan_saver",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  RESEND_API_KEY: "re_test",
  MAGIC_LINK_FROM: " Plan-Saver <test@example.com> ",
  ALLOWED_EMAILS: " First@Example.com, second@example.com ",
};

describe("environment validation", () => {
  test("accepts local HTTP and normalizes trimmed values", () => {
    expect(parseEnv(valid)).toMatchObject({
      BETTER_AUTH_URL: "http://localhost:3000",
      MAGIC_LINK_FROM: "Plan-Saver <test@example.com>",
      ALLOWED_EMAILS: ["first@example.com", "second@example.com"],
    });
    expect(parseEnv({ ...valid, DATABASE_URL: valid.DATABASE_URL.replace("postgresql:", "postgres:") }).DATABASE_URL).toStartWith("postgres:");
  });

  test.each([
    ["short secret", { BETTER_AUTH_SECRET: "too-short" }],
    ["blank secret", { BETTER_AUTH_SECRET: " ".repeat(40) }],
    ["non-Postgres database", { DATABASE_URL: "https://database.example.com/db" }],
    ["remote HTTP app URL", { BETTER_AUTH_URL: "http://example.com" }],
    ["empty sender", { MAGIC_LINK_FROM: "   " }],
    ["empty allowlist", { ALLOWED_EMAILS: " , " }],
    ["invalid allowlist address", { ALLOWED_EMAILS: "not-an-email" }],
  ])("rejects %s", (_name, override) => {
    expect(() => parseEnv({ ...valid, ...override })).toThrow();
  });

  test("accepts HTTPS outside localhost", () => {
    expect(parseEnv({ ...valid, BETTER_AUTH_URL: "https://plans.example.com" }).BETTER_AUTH_URL).toBe("https://plans.example.com");
  });

  test("validates the dedicated migration URL independently", () => {
    expect(parseDatabaseUrl("postgresql://user:pass@localhost:5432/plan_saver")).toStartWith(
      "postgresql:",
    );
    expect(() => parseDatabaseUrl(undefined)).toThrow();
    expect(() => parseDatabaseUrl("https://database.example.com/db")).toThrow();
  });
});
