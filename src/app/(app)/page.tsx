import { count, desc, eq, max } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { document, project } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";

export default async function ProjectsPage() {
  const session = await requireSession();

  const projects = await db
    .select({
      slug: project.slug,
      displayName: project.displayName,
      docCount: count(document.id),
      lastActivity: max(document.updatedAt),
    })
    .from(project)
    .leftJoin(document, eq(document.projectId, project.id))
    .where(eq(project.userId, session.user.id))
    .groupBy(project.id)
    .orderBy(desc(max(document.updatedAt)));

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="display text-[34px]">Project index</h1>
        <span className="eyebrow">
          {projects.length} project{projects.length === 1 ? "" : "s"} on register
        </span>
      </div>

      {projects.length === 0 ? (
        <div className="border border-line bg-panel-2 p-10 text-center">
          <p className="eyebrow mb-3">Register empty</p>
          <p className="text-sm text-muted">
            Create an{" "}
            <Link href="/settings/tokens" className="text-accent hover:underline">
              API token
            </Link>
            , then generate a plan from any Claude Code session. It is filed here automatically.
          </p>
        </div>
      ) : (
        <div className="border border-line-strong bg-panel">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-8 border-b border-line-strong px-5 py-2.5">
            <span className="eyebrow">Project</span>
            <span className="eyebrow text-right">Documents</span>
            <span className="eyebrow hidden text-right sm:block">Last activity</span>
          </div>
          {projects.map((p) => (
            <Link
              key={p.slug}
              href={`/p/${p.slug}`}
              className="group grid grid-cols-[1fr_auto_auto] items-baseline gap-x-8 border-b border-line px-5 py-3.5 transition-colors last:border-b-0 hover:bg-panel-2"
            >
              <span className="font-medium text-ink group-hover:text-accent transition-colors">
                {p.displayName}
              </span>
              <span className="font-mono text-sm text-muted tabular-nums">{p.docCount}</span>
              <span className="hidden font-mono text-sm text-muted sm:block">
                {formatDate(p.lastActivity)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
