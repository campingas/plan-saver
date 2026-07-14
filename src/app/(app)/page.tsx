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
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
      {projects.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nothing archived yet. Create an{" "}
          <Link href="/settings/tokens" className="underline">
            API token
          </Link>{" "}
          and generate a plan from a Claude Code session — it will show up here.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {projects.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/p/${p.slug}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="font-medium">{p.displayName}</span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {p.docCount} document{p.docCount === 1 ? "" : "s"} · last activity{" "}
                  {formatDate(p.lastActivity)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
