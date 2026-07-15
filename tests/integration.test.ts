import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { asc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db, dbClient } from "@/db";
import {
  apiToken,
  document,
  project,
  rateLimit,
  shareLink,
  user,
  version,
} from "@/db/schema";
import { getSharedVersion, listActiveShareLinks, listProjectDocuments } from "@/db/queries";
import {
  createApiTokenForUser,
  createShareLinkForUser,
  deleteDocumentForUser,
  deleteProjectForUser,
  deleteVersionForUser,
  revokeApiTokenForUser,
  revokeShareLinkForUser,
} from "@/lib/mutations";
import { retainAllowedSession } from "@/lib/session";
import { hashToken } from "@/lib/tokens";
import { highlightDocumentHtml } from "@/lib/document-highlighting";
import { MAX_HIGHLIGHT_CHARS } from "@/lib/code-highlighting";
import { machineSetupCommand, TOKEN_PLACEHOLDER } from "@/lib/machine-setup";
import { MAX_AGENT_NAME_LENGTH, UNKNOWN_AGENT } from "@/lib/agent";
import { htmlToMarkdown } from "@/lib/html-to-markdown";
import { resolveViewerContent, viewerModeFromDownload, viewerResponse } from "@/lib/viewer";
import {
  MAX_BODY_BYTES,
  MAX_HTML_BYTES,
  MAX_META_BYTES,
  POST,
} from "@/app/api/v1/documents/route";

const databaseUrl = process.env.DATABASE_URL!;
const sql = postgres(databaseUrl, { max: 1, prepare: false });
const ownerId = "10000000-0000-4000-8000-000000000001";
const otherId = "10000000-0000-4000-8000-000000000002";
let guardRejected = false;
let legacyShareHash = "";
let legacyShareUrlWorked = false;

async function migration(number: string) {
  const [path] = Array.from(new Bun.Glob(`drizzle/${number}_*.sql`).scanSync("."));
  if (!path) throw new Error(`Missing migration ${number}`);
  return readFile(path, "utf8");
}

async function resetRows() {
  await sql.unsafe(
    'truncate table "rate_limit", "verification", "session", "account", "share_link", "version", "document", "project", "api_token", "user" cascade',
  );
  await db.insert(user).values([
    { id: ownerId, name: "Owner", email: "allowed@example.com", emailVerified: true },
    { id: otherId, name: "Other", email: "other@example.com", emailVerified: true },
  ]);
}

async function addDocument(userId: string, suffix = "one", agent?: string) {
  const projectId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  await db.insert(project).values({ id: projectId, userId, slug: `project-${suffix}`, displayName: "Project" });
  await db.insert(document).values({ id: documentId, projectId, slug: `document-${suffix}`, kind: "plan", title: "Title" });
  await db.insert(version).values({
    id: versionId,
    documentId,
    number: 1,
    title: "Title",
    html: "<h1>safe</h1>",
    meta: agent === undefined ? undefined : { agent },
  });
  return { projectId, documentId, versionId };
}

function ingestRequest(token: string | null, body: BodyInit, headers: HeadersInit = {}) {
  return new NextRequest("http://localhost:3000/api/v1/documents", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    project: "plan-saver",
    slug: "optimization-plan",
    kind: "plan",
    title: "Optimization plan",
    html: "<!doctype html><h1>Plan</h1>",
    ...overrides,
  };
}

beforeAll(async () => {
  await sql.unsafe(await migration("0000"));
  await sql.unsafe(await migration("0001"));
  await sql.unsafe(`
    insert into "user" ("id", "name", "email", "email_verified") values
      ('legacy-owner', 'Owner', 'legacy-owner@example.com', true),
      ('legacy-other', 'Other', 'legacy-other@example.com', true);
    insert into "project" ("id", "user_id", "slug", "display_name") values
      ('legacy-project', 'legacy-owner', 'legacy', 'Legacy');
    insert into "document" ("id", "user_id", "project_id", "slug", "kind", "title") values
      ('legacy-document', 'legacy-other', 'legacy-project', 'legacy', 'plan', 'Legacy');
    insert into "version" ("id", "document_id", "number", "title", "html") values
      ('legacy-version', 'legacy-document', 1, 'Legacy', '<p>legacy</p>');
    insert into "share_link" ("id", "version_id", "token") values
      ('legacy-share', 'legacy-version', 'legacy-url-token');
  `);
  try {
    await sql.unsafe(await migration("0002"));
  } catch {
    guardRejected = true;
  }
  const [columnAfterGuard] = await sql<{ exists: boolean }[]>`
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'document' and column_name = 'user_id'
    ) as exists
  `;
  if (!columnAfterGuard.exists) throw new Error("Migration 0002 was not rolled back after ownership guard failure");
  await sql`update "document" set "user_id" = 'legacy-owner' where "id" = 'legacy-document'`;
  await sql.unsafe(await migration("0002"));
  await sql.unsafe(await migration("0003"));
  const [legacy] = await sql<{ token_hash: string }[]>`select "token_hash" from "share_link" where "id" = 'legacy-share'`;
  legacyShareHash = legacy.token_hash;
  legacyShareUrlWorked = Boolean(
    await resolveViewerContent({ versionId: "legacy-version", shareToken: "legacy-url-token" }),
  );
});

beforeEach(resetRows);

afterAll(async () => {
  await dbClient.end();
  await sql.end();
});

describe("migrations", () => {
  test("0002 guards ownership and 0003 preserves legacy share URLs as hashes", async () => {
    expect(guardRejected).toBeTrue();
    expect(legacyShareHash).toBe(hashToken("legacy-url-token"));
    expect(legacyShareUrlWorked).toBeTrue();
    const columns = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'share_link'
    `;
    expect(columns.map((row) => row.column_name)).toContain("token_hash");
    expect(columns.map((row) => row.column_name)).not.toContain("token");
    const [rls] = await sql<{ relrowsecurity: boolean }[]>`select relrowsecurity from pg_class where relname = 'rate_limit'`;
    expect(rls.relrowsecurity).toBeTrue();
  });
});

describe("ingest", () => {
  test("allocates monotonic versions during concurrent first and existing ingestion", async () => {
    const token = await createApiTokenForUser(ownerId, "ingest");
    const submit = () => POST(ingestRequest(token, JSON.stringify(payload())));
    const first = await Promise.all(Array.from({ length: 8 }, submit));
    expect(first.every((response) => response.status === 201)).toBeTrue();
    expect((await Promise.all(first.map((response) => response.json()))).map((body) => body.version).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const existing = await Promise.all(Array.from({ length: 4 }, submit));
    expect((await Promise.all(existing.map((response) => response.json()))).map((body) => body.version).sort((a, b) => a - b)).toEqual([9, 10, 11, 12]);
  });

  test("rejects missing, invalid, and revoked tokens", async () => {
    expect((await POST(ingestRequest(null, JSON.stringify(payload())))).status).toBe(401);
    expect((await POST(ingestRequest("invalid", JSON.stringify(payload())))).status).toBe(401);
    const token = await createApiTokenForUser(ownerId, "revoked");
    const [stored] = await db.select().from(apiToken).where(eq(apiToken.tokenHash, hashToken(token)));
    await revokeApiTokenForUser(ownerId, stored.id);
    expect((await POST(ingestRequest(token, JSON.stringify(payload())))).status).toBe(401);
  });

  test("rejects malformed, declared oversized, and actual oversized JSON bodies", async () => {
    const token = await createApiTokenForUser(ownerId, "validation");
    expect((await POST(ingestRequest(token, "{"))).status).toBe(400);
    expect((await POST(ingestRequest(token, "{}", { "content-length": String(MAX_BODY_BYTES + 1) }))).status).toBe(413);
    expect((await POST(ingestRequest(token, new Uint8Array(MAX_BODY_BYTES + 1)))).status).toBe(413);
  });

  test("enforces HTML and serialized metadata byte limits at UTF-8 boundaries", async () => {
    const token = await createApiTokenForUser(ownerId, "boundaries");
    const exactHtml = "😀".repeat(MAX_HTML_BYTES / 4);
    expect((await POST(ingestRequest(token, JSON.stringify(payload({ slug: "exact-html", html: exactHtml }))))).status).toBe(201);
    expect((await POST(ingestRequest(token, JSON.stringify(payload({ slug: "large-html", html: `${exactHtml}😀` }))))).status).toBe(400);
    const exactMeta = { value: "a".repeat(MAX_META_BYTES - 12) };
    expect(new TextEncoder().encode(JSON.stringify(exactMeta)).byteLength).toBe(MAX_META_BYTES);
    expect((await POST(ingestRequest(token, JSON.stringify(payload({ slug: "exact-meta", meta: exactMeta }))))).status).toBe(201);
    exactMeta.value += "😀";
    expect((await POST(ingestRequest(token, JSON.stringify(payload({ slug: "large-meta", meta: exactMeta }))))).status).toBe(400);
  });

  test("normalizes valid agent metadata and rejects invalid agent names", async () => {
    const token = await createApiTokenForUser(ownerId, "agents");
    const valid = await POST(
      ingestRequest(
        token,
        JSON.stringify(payload({ slug: "agent-valid", meta: { agent: "  Codex  ", branch: "main" } })),
      ),
    );
    expect(valid.status).toBe(201);
    const [stored] = await db.select({ meta: version.meta }).from(version).where(eq(version.title, "Optimization plan"));
    expect(stored.meta).toMatchObject({ agent: "Codex", branch: "main" });

    for (const agent of ["", "Claude\nCode", "x".repeat(MAX_AGENT_NAME_LENGTH + 1), 42]) {
      const response = await POST(
        ingestRequest(token, JSON.stringify(payload({ slug: "agent-invalid", meta: { agent } }))),
      );
      expect(response.status).toBe(400);
    }
  });

  test("lists the newest revision agent without changing document versioning", async () => {
    const token = await createApiTokenForUser(ownerId, "latest-agent");
    expect(
      (await POST(ingestRequest(token, JSON.stringify(payload({ slug: "agent-history", meta: { agent: "Codex" } }))))).status,
    ).toBe(201);
    expect(
      (await POST(ingestRequest(token, JSON.stringify(payload({ slug: "agent-history", meta: { agent: "Claude" } }))))).status,
    ).toBe(201);

    const [proj] = await db.select().from(project).where(eq(project.userId, ownerId));
    const row = (await listProjectDocuments(ownerId, proj.id)).find((item) => item.slug === "agent-history");
    expect(row?.agent).toBe("Claude");
    expect(row?.versionCount).toBe(2);
  });

  test("isolates identical project and document slugs by owner", async () => {
    const ownerToken = await createApiTokenForUser(ownerId, "owner");
    const otherToken = await createApiTokenForUser(otherId, "other");
    await POST(ingestRequest(ownerToken, JSON.stringify(payload())));
    await POST(ingestRequest(otherToken, JSON.stringify(payload({ title: "Other title" }))));
    const projects = await db.select().from(project).orderBy(asc(project.userId));
    expect(projects).toHaveLength(2);
    expect(await listProjectDocuments(ownerId, projects.find((row) => row.userId === ownerId)!.id)).toHaveLength(1);
    expect(await listProjectDocuments(ownerId, projects.find((row) => row.userId === otherId)!.id)).toHaveLength(0);
  });
});

describe("authorized mutations", () => {
  test("enforces ownership for all four mutation services", async () => {
    const token = await createApiTokenForUser(ownerId, "desktop");
    const [storedToken] = await db.select().from(apiToken).where(eq(apiToken.tokenHash, hashToken(token)));
    expect(await revokeApiTokenForUser(otherId, storedToken.id)).toBeFalse();
    expect(await revokeApiTokenForUser(ownerId, storedToken.id)).toBeTrue();

    const { versionId } = await addDocument(ownerId);
    expect(await createShareLinkForUser(otherId, versionId)).toBeNull();
    const shareToken = await createShareLinkForUser(ownerId, versionId);
    if (!shareToken) throw new Error("Owner could not create a share link");
    const [storedShare] = await db.select().from(shareLink).where(eq(shareLink.tokenHash, hashToken(shareToken)));
    expect(storedShare.tokenHash).not.toBe(shareToken);
    expect(await listActiveShareLinks(ownerId, versionId)).toEqual([{ id: storedShare.id, createdAt: storedShare.createdAt }]);
    await expect(revokeShareLinkForUser(otherId, storedShare.id)).rejects.toThrow("Share link not found");
    expect(await revokeShareLinkForUser(ownerId, storedShare.id)).toBeTrue();
  });
});

describe("deletion mutations", () => {
  test("rejects deletion by a non-owner and keeps every row", async () => {
    const { projectId, documentId, versionId } = await addDocument(ownerId);
    expect(await deleteVersionForUser(otherId, versionId)).toBeNull();
    expect(await deleteDocumentForUser(otherId, documentId)).toBeNull();
    expect(await deleteProjectForUser(otherId, projectId)).toBeFalse();
    expect(await db.select().from(version).where(eq(version.id, versionId))).toHaveLength(1);
    expect(await db.select().from(document).where(eq(document.id, documentId))).toHaveLength(1);
    expect(await db.select().from(project).where(eq(project.id, projectId))).toHaveLength(1);
  });

  test("deletes a non-last version, cascades its share link, and keeps the document", async () => {
    const { documentId, versionId } = await addDocument(ownerId);
    await db.insert(version).values({ id: crypto.randomUUID(), documentId, number: 2, title: "Title", html: "<p>v2</p>" });
    const shareToken = await createShareLinkForUser(ownerId, versionId);
    if (!shareToken) throw new Error("Owner could not create a share link");
    expect(await deleteVersionForUser(ownerId, versionId)).toEqual({ projectSlug: "project-one", documentDeleted: false });
    expect(await db.select().from(shareLink)).toHaveLength(0);
    expect(await getSharedVersion(shareToken)).toBeNull();
    expect(await db.select().from(version).where(eq(version.documentId, documentId))).toHaveLength(1);
    expect(await db.select().from(document).where(eq(document.id, documentId))).toHaveLength(1);
  });

  test("deleting the last version removes the document but keeps the project", async () => {
    const { projectId, documentId, versionId } = await addDocument(ownerId);
    expect(await deleteVersionForUser(ownerId, versionId)).toEqual({ projectSlug: "project-one", documentDeleted: true });
    expect(await db.select().from(document).where(eq(document.id, documentId))).toHaveLength(0);
    expect(await db.select().from(project).where(eq(project.id, projectId))).toHaveLength(1);
  });

  test("document deletion cascades versions and share links but keeps the project", async () => {
    const { projectId, documentId, versionId } = await addDocument(ownerId);
    await createShareLinkForUser(ownerId, versionId);
    expect(await deleteDocumentForUser(ownerId, documentId)).toEqual({ projectSlug: "project-one" });
    expect(await db.select().from(version)).toHaveLength(0);
    expect(await db.select().from(shareLink)).toHaveLength(0);
    expect(await db.select().from(project).where(eq(project.id, projectId))).toHaveLength(1);
  });

  test("project deletion removes the owner's tree and spares another user's data", async () => {
    const owned = await addDocument(ownerId);
    const other = await addDocument(otherId, "other");
    await createShareLinkForUser(ownerId, owned.versionId);
    expect(await deleteProjectForUser(ownerId, owned.projectId)).toBeTrue();
    expect(await db.select().from(project)).toHaveLength(1);
    expect(await db.select().from(shareLink)).toHaveLength(0);
    expect(await db.select().from(document).where(eq(document.id, other.documentId))).toHaveLength(1);
    expect(await db.select().from(version).where(eq(version.id, other.versionId))).toHaveLength(1);
  });

  test("ingest still allocates after the latest version is deleted", async () => {
    const token = await createApiTokenForUser(ownerId, "after-delete");
    expect((await POST(ingestRequest(token, JSON.stringify(payload())))).status).toBe(201);
    const second = await POST(ingestRequest(token, JSON.stringify(payload())));
    expect((await second.json()).version).toBe(2);
    const [latest] = await db.select().from(version).where(eq(version.number, 2));
    expect(await deleteVersionForUser(ownerId, latest.id)).toEqual({ projectSlug: "plan-saver", documentDeleted: false });
    const third = await POST(ingestRequest(token, JSON.stringify(payload())));
    expect(third.status).toBe(201);
    expect((await third.json()).version).toBe(2);
  });
});

describe("viewer", () => {
  test("authorizes owner and active share, rejects other owner and revoked or mismatched shares", async () => {
    const owned = await addDocument(ownerId, "viewer", "Codex");
    const other = await addDocument(otherId, "other-viewer");
    const ownerContent = await resolveViewerContent({ versionId: owned.versionId, userId: ownerId });
    expect(ownerContent?.html).toBe("<h1>safe</h1>");
    expect(ownerContent?.agent).toBe("Codex");
    expect(await resolveViewerContent({ versionId: owned.versionId, userId: otherId })).toBeNull();
    const token = await createShareLinkForUser(ownerId, owned.versionId);
    if (!token) throw new Error("Owner could not create a share link");
    const sharedContent = await resolveViewerContent({ versionId: owned.versionId, shareToken: token });
    expect(sharedContent?.html).toBe("<h1>safe</h1>");
    expect(sharedContent?.agent).toBe("Codex");
    expect(await resolveViewerContent({ versionId: other.versionId, shareToken: token })).toBeNull();
    const [link] = await db.select().from(shareLink).where(eq(shareLink.tokenHash, hashToken(token)));
    await revokeShareLinkForUser(ownerId, link.id);
    expect(await resolveViewerContent({ versionId: owned.versionId, shareToken: token })).toBeNull();
  });

  test("highlights display HTML while preserving raw downloads and security headers", async () => {
    const html = '<!doctype html><html><head></head><body><pre><code class="language-typescript">const value = 1;</code></pre></body></html>';
    const display = viewerResponse({ number: 3, slug: "safe-name", agent: "Codex", html }, "display");
    const response = viewerResponse({ number: 3, slug: "safe-name", agent: "Codex", html }, "html");
    const displayHtml = await display.text();

    expect(displayHtml).toContain('class="language-typescript hljs"');
    expect(displayHtml).toContain("hljs-keyword");
    expect(displayHtml).toContain("Agent: <span data-plan-saver-agent=\"\">Codex</span>");
    expect(await response.text()).toBe(html);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
    expect(response.headers.get("content-security-policy")).not.toContain("https:");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="safe-name-v3.html"');
    expect(viewerResponse(null, "display").status).toBe(404);
  });

  test("derives safe GitHub-Flavored Markdown with fenced language code", () => {
    const html = `<!doctype html>
      <html>
        <head><style>body { color: red; }</style><script>headScript()</script></head>
        <body>
          <h1>Export</h1>
          <p><a href="https://example.com/docs">Safe</a> and <a href="java&#x0a;script:alert(1)">unsafe</a>.</p>
          <table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>Agent</td><td>Codex</td></tr></tbody></table>
          <ul><li><input type="checkbox" checked>Done</li></ul>
          <p><del>Old</del></p>
          <pre><code class="language-typescript">const value = 1;</code></pre>
          <img alt="Unsafe image" src="data:text/html;base64,PHNjcmlwdD4=">
          <script>bodyScript()</script>
        </body>
      </html>`;

    const markdown = htmlToMarkdown(html);

    expect(markdown).toContain("# Export");
    expect(markdown).toContain("[Safe](https://example.com/docs)");
    expect(markdown).toContain("and unsafe.");
    expect(markdown).not.toContain("javascript:");
    expect(markdown).toContain("| Name");
    expect(markdown).toContain("| Agent");
    expect(markdown).toContain("[x] Done");
    expect(markdown).toContain("~~Old~~");
    expect(markdown).toContain("```typescript\nconst value = 1;\n```");
    expect(markdown).toContain("Unsafe image");
    expect(markdown).not.toContain("data:text/html");
    expect(markdown).not.toContain("headScript");
    expect(markdown).not.toContain("bodyScript");
    expect(markdown.endsWith("\n")).toBeTrue();
    expect(markdown.endsWith("\n\n")).toBeFalse();
  });

  test("serves Markdown attachments and maps download modes without changing display defaults", async () => {
    const html = "<h1>Export</h1><p>Body</p>";
    const response = viewerResponse({ number: 4, slug: "safe-name", html }, "markdown");

    expect(await response.text()).toBe("# Export\n\nBody\n");
    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="safe-name-v4.md"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(viewerModeFromDownload("1")).toBe("html");
    expect(viewerModeFromDownload("markdown")).toBe("markdown");
    expect(viewerModeFromDownload(null)).toBe("display");
    expect(viewerModeFromDownload("unknown")).toBe("display");
  });
});

describe("code highlighting", () => {
  test("builds placeholder and issued-token machine setup commands", () => {
    const placeholder = machineSetupCommand("https://plans.example");
    const issued = machineSetupCommand("https://plans.example", "ps_live_issued");

    expect(placeholder).toContain(`"token": "${TOKEN_PLACEHOLDER}"`);
    expect(issued).toContain('"url": "https://plans.example"');
    expect(issued).toContain('"token": "ps_live_issued"');
    expect(issued.endsWith("\nEOF")).toBeTrue();
  });

  test("highlights explicit, unknown, and unlabelled languages without emitting code markup", () => {
    const explicit = highlightDocumentHtml('<pre><code class="language-typescript">const value = &lt;script&gt;;</code></pre>');
    const unknown = highlightDocumentHtml('<pre><code class="language-madeup">{"value": true}</code></pre>');
    const unlabelled = highlightDocumentHtml("<pre><code>const value = 1;</code></pre>");

    expect(explicit).toContain("hljs-keyword");
    expect(explicit).not.toContain("<script>");
    expect(unknown).toContain('class="language-madeup hljs"');
    expect(unlabelled).toContain('class="hljs"');
  });

  test("leaves already highlighted and oversized blocks unchanged", () => {
    const highlighted = '<pre><code class="hljs"><span class="hljs-keyword">const</span></code></pre>';
    const oversized = `<pre><code>${"x".repeat(MAX_HIGHLIGHT_CHARS + 1)}</code></pre>`;

    expect(highlightDocumentHtml(highlighted)).toBe(highlighted);
    expect(highlightDocumentHtml(oversized)).toBe(oversized);
  });

  test("keeps malformed code blocks viewable", () => {
    const result = highlightDocumentHtml('<pre><code class="language-html">&lt;div');
    expect(result).toContain("&lt;div");
    expect(result).toContain("hljs");
  });

  test("adds safe per-revision footer attribution without duplicating marked templates", () => {
    const marked = highlightDocumentHtml(
      "<footer>Generated by <span data-plan-saver-agent>Old</span></footer>",
      "Claude",
    );
    const existingFooter = highlightDocumentHtml("<main>Body</main><footer>Existing</footer>", "Codex");
    const fallback = highlightDocumentHtml("<main>Body</main>", null);
    const escaped = highlightDocumentHtml("<main>Body</main>", "Agent <script>");

    expect(marked.match(/data-plan-saver-agent/g)).toHaveLength(1);
    expect(marked).toContain('data-plan-saver-agent="">Claude</span>');
    expect(existingFooter).toContain("Existing · Agent:");
    expect(fallback).toContain('data-plan-saver-footer=""');
    expect(fallback).toContain(`>${UNKNOWN_AGENT}</span>`);
    expect(escaped).toContain("Agent &lt;script&gt;");
    expect(escaped).not.toContain("<script>");
  });
});

describe("authentication controls", () => {
  test("invalidates existing sessions when their email leaves the allowlist", () => {
    const allowed = { user: { email: "allowed@example.com" }, session: { id: "one" } };
    const removed = { user: { email: "removed@example.com" }, session: { id: "two" } };
    expect(retainAllowedSession(allowed)).toBe(allowed);
    expect(retainAllowedSession(removed)).toBeNull();
  });

  test("uses the verified Better Auth 1.6.23 database rate-limit adapter and explicit lifetimes", async () => {
    const context = await auth.$context;
    expect(context.rateLimit.storage).toBe("database");
    expect(context.rateLimit.enabled).toBeTrue();
    expect(context.sessionConfig.expiresIn).toBe(60 * 60 * 24 * 7);
    expect(context.sessionConfig.updateAge).toBe(60 * 60 * 24);
    expect(context.options.plugins?.find((plugin) => plugin.id === "magic-link")?.options?.expiresIn).toBe(60 * 5);
    const response = await auth.handler(new Request("http://localhost:3000/api/auth/get-session", { headers: { "x-forwarded-for": "192.0.2.1" } }));
    expect(response.status).toBe(200);
    expect((await db.select().from(rateLimit)).length).toBeGreaterThan(0);
  });
});
