import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForUser, listProjectDocuments } from "@/db/queries";
import { DeleteProjectForm } from "@/components/delete-project-form";
import { KindBadge } from "@/components/kind-badge";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { documentPath } from "@/lib/urls";

type Params = Promise<{ project: string }>;

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Params }) {
  const session = await requireSession();
  const { project: projectSlug } = await params;

  const proj = await getProjectForUser(session.user.id, projectSlug);
  if (!proj) notFound();

  const documents = await listProjectDocuments(session.user.id, proj.id);

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
            href={documentPath(proj.slug, d.slug, d.kind)}
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

      <section className="border border-line-strong bg-panel lg:max-w-sm">
        <h2 className="eyebrow border-b border-line-strong px-4 py-2">Danger zone</h2>
        <div className="space-y-3 p-4">
          <p className="text-xs text-muted">
            Deletes this project with all of its plans, reports, revisions, and share links.
          </p>
          <DeleteProjectForm projectId={proj.id} slug={proj.slug} />
        </div>
      </section>
    </div>
  );
}
