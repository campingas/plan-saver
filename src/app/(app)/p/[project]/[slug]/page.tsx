import { and, asc, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { document, project, shareLink, version } from "@/db/schema";
import { KindBadge } from "@/components/kind-badge";
import { createShareLink, revokeShareLink } from "@/lib/actions";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string; slug: string }>;
  searchParams: Promise<{ v?: string; kind?: string }>;
}) {
  const session = await requireSession();
  const { project: projectSlug, slug } = await params;
  const { v, kind } = await searchParams;

  const [proj] = await db
    .select()
    .from(project)
    .where(and(eq(project.userId, session.user.id), eq(project.slug, projectSlug)))
    .limit(1);
  if (!proj) notFound();

  const docs = await db
    .select()
    .from(document)
    .where(and(eq(document.projectId, proj.id), eq(document.slug, slug)))
    .orderBy(asc(document.kind));
  // (projectId, slug, kind) is unique, so at most one plan and one report share a slug
  const doc = docs.find((d) => d.kind === (kind === "report" ? "report" : "plan")) ?? docs[0];
  if (!doc) notFound();

  const versions = await db
    .select({ id: version.id, number: version.number, title: version.title, createdAt: version.createdAt })
    .from(version)
    .where(eq(version.documentId, doc.id))
    .orderBy(desc(version.number));
  if (versions.length === 0) notFound();

  const selected = versions.find((x) => String(x.number) === v) ?? versions[0];

  const shares = await db
    .select({ id: shareLink.id, token: shareLink.token, createdAt: shareLink.createdAt })
    .from(shareLink)
    .where(and(eq(shareLink.versionId, selected.id), isNull(shareLink.revokedAt)))
    .orderBy(desc(shareLink.createdAt));

  const base = process.env.BETTER_AUTH_URL ?? "";
  const versionHref = (n: number) =>
    `/p/${proj.slug}/${doc.slug}?${doc.kind === "report" ? "kind=report&" : ""}v=${n}`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/p/${proj.slug}`}
          className="eyebrow hover:text-accent transition-colors"
        >
          ← {proj.displayName}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="display text-[30px]">{selected.title}</h1>
          <KindBadge kind={doc.kind} />
          <span className="stamp text-muted">rev v{selected.number}</span>
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="w-full shrink-0 space-y-6 lg:w-60">
          <section className="border border-line-strong bg-panel">
            <h2 className="eyebrow border-b border-line-strong px-4 py-2">Revisions</h2>
            <ul>
              {versions.map((x) => (
                <li key={x.id} className="border-b border-line last:border-b-0">
                  <Link
                    href={versionHref(x.number)}
                    className={`flex items-baseline justify-between px-4 py-2.5 font-mono text-sm transition-colors ${
                      x.id === selected.id
                        ? "border-l-2 border-accent bg-panel-2 text-ink"
                        : "border-l-2 border-transparent text-muted hover:text-ink"
                    }`}
                  >
                    <span>v{x.number}</span>
                    <span className="text-xs">{formatDate(x.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="border border-line-strong bg-panel">
            <h2 className="eyebrow border-b border-line-strong px-4 py-2">
              Share links · v{selected.number}
            </h2>
            <div className="space-y-3 p-4">
              {shares.length === 0 && (
                <p className="text-xs text-muted">None issued. A share link opens this revision without signing in.</p>
              )}
              {shares.map((s) => (
                <div key={s.id} className="space-y-1.5 border border-line bg-panel-2 p-2.5">
                  <input
                    readOnly
                    value={`${base}/s/${s.token}`}
                    className="w-full bg-transparent font-mono text-xs text-ink outline-none"
                  />
                  <form action={revokeShareLink.bind(null, s.id)}>
                    <button className="stamp cursor-pointer text-stamp hover:bg-stamp hover:text-paper transition-colors">
                      Revoke
                    </button>
                  </form>
                </div>
              ))}
              <form action={createShareLink.bind(null, selected.id)}>
                <button className="btn btn-ghost w-full">Issue share link</button>
              </form>
            </div>
          </section>

          <a
            href={`/api/view/${selected.id}?download=1`}
            className="eyebrow block hover:text-accent transition-colors"
          >
            ↓ Download raw HTML
          </a>
        </aside>

        {/* sandbox without allow-same-origin: archived HTML runs its inline
            scripts but can never reach the app's cookies or DOM */}
        <div className="plate min-w-0 flex-1">
          <iframe
            key={selected.id}
            sandbox="allow-scripts"
            src={`/api/view/${selected.id}`}
            title={`${selected.title} (v${selected.number})`}
            className="block h-[80vh] w-full"
          />
        </div>
      </div>
    </div>
  );
}
