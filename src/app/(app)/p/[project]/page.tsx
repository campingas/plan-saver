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
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          ← Projects
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{proj.displayName}</h1>
      </div>
      <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {documents.map((d) => (
          <li key={`${d.slug}-${d.kind}`}>
            <Link
              href={`/p/${proj.slug}/${d.slug}${d.kind === "report" ? "?kind=report" : ""}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span className="flex items-center gap-2">
                <KindBadge kind={d.kind} />
                <span className="font-medium">{d.title}</span>
              </span>
              <span className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
                v{d.versionCount} · {formatDate(d.updatedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
