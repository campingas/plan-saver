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
          className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          ← {proj.displayName}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <KindBadge kind={doc.kind} />
          <h1 className="text-xl font-semibold tracking-tight">{selected.title}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 space-y-6 lg:w-64">
          <section>
            <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Versions</h2>
            <ul className="space-y-1">
              {versions.map((x) => (
                <li key={x.id}>
                  <Link
                    href={versionHref(x.number)}
                    className={`block rounded px-2 py-1.5 text-sm ${
                      x.id === selected.id
                        ? "bg-zinc-100 font-medium dark:bg-zinc-800"
                        : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
                    }`}
                  >
                    v{x.number}
                    <span className="block text-xs text-zinc-400 dark:text-zinc-500">
                      {formatDate(x.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Share links (v{selected.number})
            </h2>
            <div className="space-y-2">
              {shares.map((s) => (
                <div key={s.id} className="space-y-1 rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                  <input
                    readOnly
                    value={`${base}/s/${s.token}`}
                    className="w-full bg-transparent text-xs text-zinc-600 outline-none dark:text-zinc-300"
                  />
                  <form action={revokeShareLink.bind(null, s.id)}>
                    <button className="text-xs text-red-600 hover:underline dark:text-red-400">
                      Revoke
                    </button>
                  </form>
                </div>
              ))}
              <form action={createShareLink.bind(null, selected.id)}>
                <button className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                  Create share link
                </button>
              </form>
            </div>
          </section>

          <a
            href={`/api/view/${selected.id}?download=1`}
            className="block text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            Download raw HTML
          </a>
        </aside>

        {/* sandbox without allow-same-origin: archived HTML can run its inline
            scripts but can never reach the app's cookies or DOM */}
        <iframe
          key={selected.id}
          sandbox="allow-scripts"
          src={`/api/view/${selected.id}`}
          title={`${selected.title} (v${selected.number})`}
          className="h-[80vh] w-full rounded-md border border-zinc-200 bg-white dark:border-zinc-800"
        />
      </div>
    </div>
  );
}
