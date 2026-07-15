import { and, eq, isNull, max, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { apiToken, document, documentKinds, project, version } from "@/db/schema";
import { hashToken } from "@/lib/tokens";
import { absoluteUrl, documentPath } from "@/lib/urls";
import { logServerEvent } from "@/lib/log";

const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_META_BYTES = 64 * 1024;
export const MAX_BODY_BYTES = 8 * 1024 * 1024;
const encoder = new TextEncoder();

function utf8Bytes(value: string): number {
  return encoder.encode(value).byteLength;
}

const bodySchema = z.object({
  project: z.string().min(1).max(100).regex(kebab, "must be kebab-case"),
  slug: z.string().min(1).max(150).regex(kebab, "must be kebab-case"),
  kind: z.enum(documentKinds),
  title: z.string().min(1).max(300),
  html: z
    .string()
    .min(1)
    .refine((value) => utf8Bytes(value) <= MAX_HTML_BYTES, "html exceeds 2 MiB"),
  meta: z
    .record(z.string(), z.unknown())
    .refine(
      (value) => utf8Bytes(JSON.stringify(value)) <= MAX_META_BYTES,
      "serialized meta exceeds 64 KiB",
    )
    .optional(),
});

async function authenticate(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const tokenHash = hashToken(header.slice("Bearer ".length).trim());
  const [row] = await db
    .update(apiToken)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(apiToken.tokenHash, tokenHash), isNull(apiToken.revokedAt)))
    .returning({ userId: apiToken.userId });
  return row?.userId ?? null;
}

class BodyTooLargeError extends Error {}

async function readJsonBody(req: NextRequest): Promise<unknown> {
  const declaredLength = req.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) {
    throw new BodyTooLargeError();
  }
  if (!req.body) throw new SyntaxError("missing body");

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = req.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function POST(req: NextRequest) {
  const startedAt = performance.now();
  const respond = (body: object, status: number, outcome: string) => {
    logServerEvent({
      event: "ingest",
      outcome,
      status,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return NextResponse.json(body, { status });
  };

  const userId = await authenticate(req);
  if (!userId) {
    return respond({ error: "invalid or revoked token" }, 401, "unauthorized");
  }

  let json: unknown;
  try {
    json = await readJsonBody(req);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return respond({ error: "request body too large" }, 413, "body_too_large");
    }
    return respond({ error: "body must be JSON" }, 400, "malformed_json");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return respond(
      { error: "validation failed", issues: parsed.error.issues },
      400,
      "validation_failed",
    );
  }
  const body = parsed.data;

  try {
    const inserted = await db.transaction(async (tx) => {
      const [proj] = await tx
        .insert(project)
        .values({ userId, slug: body.project, displayName: body.project })
        .onConflictDoUpdate({
          target: [project.userId, project.slug],
          set: { slug: body.project },
        })
        .returning({ id: project.id, slug: project.slug });

      const [doc] = await tx
        .insert(document)
        .values({
          projectId: proj.id,
          slug: body.slug,
          kind: body.kind,
          title: body.title,
        })
        .onConflictDoUpdate({
          target: [document.projectId, document.slug, document.kind],
          set: { slug: body.slug },
        })
        .returning({ id: document.id, slug: document.slug });

      // Every writer locks project then document in the same order. Holding the
      // document row lock serializes number allocation for this document only.
      await tx.execute(
        sql`select ${document.id} from ${document} where ${document.id} = ${doc.id} for update`,
      );

      const [{ current }] = await tx
        .select({ current: max(version.number) })
        .from(version)
        .where(eq(version.documentId, doc.id));
      const number = (current ?? 0) + 1;

      await tx.insert(version).values({
        documentId: doc.id,
        number,
        title: body.title,
        html: body.html,
        meta: body.meta,
      });

      await tx
        .update(document)
        .set({ title: body.title, updatedAt: new Date() })
        .where(eq(document.id, doc.id));

      return { projectSlug: proj.slug, documentSlug: doc.slug, number };
    });

    return respond(
      {
        url: absoluteUrl(
          documentPath(inserted.projectSlug, inserted.documentSlug, body.kind, inserted.number),
        ),
        version: inserted.number,
      },
      201,
      "ok",
    );
  } catch {
    logServerEvent({
      event: "ingest",
      outcome: "failed",
      status: 500,
      durationMs: Math.round(performance.now() - startedAt),
    });
    throw new Error("Document ingestion failed");
  }
}
