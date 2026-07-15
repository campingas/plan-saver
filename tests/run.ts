import postgres from "postgres";

const containerName = `plan-saver-test-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
const suppliedUrl = process.env.TEST_DATABASE_URL;
let databaseUrl = suppliedUrl;
let containerStarted = false;
let cleaning = false;

async function command(args: string[], quiet = false) {
  const proc = Bun.spawn(args, {
    stdout: quiet ? "pipe" : "inherit",
    stderr: quiet ? "pipe" : "inherit",
  });
  const exitCode = await proc.exited;
  const output = quiet ? await new Response(proc.stdout).text() : "";
  if (exitCode !== 0) throw new Error(`${args.join(" ")} exited ${exitCode}`);
  return output.trim();
}

async function waitForDatabase(url: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const sql = postgres(url, { max: 1, connect_timeout: 2 });
    try {
      await sql`select 1`;
      await sql.end();
      return;
    } catch {
      await sql.end({ timeout: 0 });
      await Bun.sleep(250);
    }
  }
  throw new Error("PostgreSQL did not become ready within 30 seconds");
}

async function resetDedicatedDatabase(url: string) {
  const parsed = new URL(url);
  const databaseName = parsed.pathname.slice(1);
  if (!/test/i.test(databaseName)) {
    throw new Error("TEST_DATABASE_URL database name must contain 'test'; the test runner resets public");
  }
  const sql = postgres(url, { max: 1 });
  try {
    await sql.unsafe('drop schema if exists public cascade; create schema public');
  } finally {
    await sql.end();
  }
}

async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  if (suppliedUrl) {
    try {
      await resetDedicatedDatabase(suppliedUrl);
    } catch (error) {
      console.error("Failed to clean TEST_DATABASE_URL", error);
    }
  }
  if (containerStarted) {
    await command(["docker", "rm", "-f", containerName], true).catch(() => undefined);
    containerStarted = false;
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(1));
  });
}

let exitCode = 1;
try {
  if (!databaseUrl) {
    if (!Bun.which("docker")) throw new Error("Docker is required when TEST_DATABASE_URL is not set");
    await command([
      "docker",
      "run",
      "--rm",
      "--detach",
      "--name",
      containerName,
      "--env",
      "POSTGRES_PASSWORD=plan-saver-test",
      "--env",
      "POSTGRES_DB=plan_saver_test",
      "--publish",
      "127.0.0.1::5432",
      "postgres:17-alpine",
    ], true);
    containerStarted = true;
    const published = await command(["docker", "port", containerName, "5432/tcp"], true);
    const port = published.match(/:(\d+)$/)?.[1];
    if (!port) throw new Error(`Could not parse PostgreSQL port: ${published}`);
    databaseUrl = `postgresql://postgres:plan-saver-test@127.0.0.1:${port}/plan_saver_test`;
  }

  await waitForDatabase(databaseUrl);
  await resetDedicatedDatabase(databaseUrl);
  const child = Bun.spawn(
    [process.execPath, "test", "--preload", "./tests/preload.ts", "tests/env.test.ts", "tests/integration.test.ts"],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
        BETTER_AUTH_URL: "http://localhost:3000",
        RESEND_API_KEY: "re_test",
        MAGIC_LINK_FROM: "Plan-Saver <test@example.com>",
        ALLOWED_EMAILS: "allowed@example.com",
      },
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  exitCode = await child.exited;
} finally {
  await cleanup();
}

process.exit(exitCode);
