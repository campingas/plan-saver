import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { document, shareLink, version } from "@/db/schema";
import { KindBadge } from "@/components/kind-badge";

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
    <div className="reveal mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <p className="eyebrow mb-1.5">Plan-Saver · shared document</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="display text-[30px]">{row.title}</h1>
          <KindBadge kind={row.kind} />
          <span className="stamp text-muted">rev v{row.number}</span>
        </div>
      </div>
      <div className="plate min-h-0 flex-1">
        <iframe
          sandbox="allow-scripts"
          src={`/api/view/${row.versionId}?share=${encodeURIComponent(token)}`}
          title={`${row.title} (v${row.number})`}
          className="block h-[85vh] w-full"
        />
      </div>
    </div>
  );
}
