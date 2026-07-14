import { and, count, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { document, project, version } from "@/db/schema";
import { KindBadge } from "@/components/kind-badge";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const session = await requireSession();
  const { project: projectSlug } = await params;

  const [proj] = await db
    .select()
    .from(project)
    .where(and(eq(project.userId, session.user.id), eq(project.slug, projectSlug)))
    .limit(1);
  if (!proj) notFound();

  const documents = await db
    .select({
      slug: document.slug,
      kind: document.kind,
      title: document.title,
      updatedAt: document.updatedAt,
      versionCount: count(version.id),
    })
    .from(document)
    .leftJoin(version, eq(version.documentId, document.id))
    .where(eq(document.projectId, proj.id))
    .groupBy(document.id)
    .orderBy(desc(document.updatedAt));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="eyebrow hover:text-accent transition-colors">
          ← Project index
        </Link>
        <h1 className="display mt-2 text-[34px]">{proj.displayName}</h1>
      </div>

      <div className="border border-line-strong bg-panel">
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-baseline gap-x-6 border-b border-line-strong px-5 py-2.5">
          <span className="eyebrow w-16">Kind</span>
          <span className="eyebrow">Document</span>
          <span className="eyebrow text-right">Rev</span>
          <span className="eyebrow hidden text-right sm:block">Updated</span>
        </div>
        {documents.map((d) => (
          <Link
            key={`${d.slug}-${d.kind}`}
            href={`/p/${proj.slug}/${d.slug}${d.kind === "report" ? "?kind=report" : ""}`}
            className="group grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-6 border-b border-line px-5 py-3.5 transition-colors last:border-b-0 hover:bg-panel-2"
          >
            <span className="w-16">
              <KindBadge kind={d.kind} />
            </span>
            <span className="font-medium text-ink group-hover:text-accent transition-colors">
              {d.title}
            </span>
            <span className="font-mono text-sm text-muted tabular-nums">v{d.versionCount}</span>
            <span className="hidden font-mono text-sm text-muted sm:block">
              {formatDate(d.updatedAt)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
