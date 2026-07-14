import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { document, shareLink, version } from "@/db/schema";

export default async function SharedVersionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [row] = await db
    .select({
      versionId: version.id,
      number: version.number,
      title: version.title,
      kind: document.kind,
    })
    .from(shareLink)
    .innerJoin(version, eq(shareLink.versionId, version.id))
    .innerJoin(document, eq(version.documentId, document.id))
    .where(and(eq(shareLink.token, token), isNull(shareLink.revokedAt)))
    .limit(1);
  if (!row) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{row.title}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Shared {row.kind} · v{row.number} · Plan-Saver
        </p>
      </div>
      <iframe
        sandbox="allow-scripts"
        src={`/api/view/${row.versionId}?share=${encodeURIComponent(token)}`}
        title={`${row.title} (v${row.number})`}
        className="h-[85vh] w-full rounded-md border border-zinc-200 bg-white dark:border-zinc-800"
      />
    </div>
  );
}
