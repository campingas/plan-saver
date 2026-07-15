import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findDocument,
  getProjectForUser,
  listActiveShareLinks,
  listVersions,
} from "@/db/queries";
import { KindBadge } from "@/components/kind-badge";
import { CreateShareLinkForm } from "@/components/create-share-link-form";
import { revokeShareLink } from "@/lib/actions";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { documentPath } from "@/lib/urls";

type Params = Promise<{ project: string; slug: string }>;
type SearchParams = Promise<{ v?: string; kind?: string }>;

function preferredKind(kind: string | undefined) {
  return kind === "report" ? ("report" as const) : ("plan" as const);
}

async function loadDocument(params: Params, searchParams: SearchParams) {
  const session = await requireSession();
  const { project: projectSlug, slug } = await params;
  const { v, kind } = await searchParams;

  const proj = await getProjectForUser(session.user.id, projectSlug);
  if (!proj) return null;
  const doc = await findDocument(session.user.id, proj.id, slug, preferredKind(kind));
  if (!doc) return null;
  const versions = await listVersions(session.user.id, doc.id);
  if (versions.length === 0) return null;
  const selected = versions.find((x) => String(x.number) === v) ?? versions[0];
  return { userId: session.user.id, proj, doc, versions, selected };
}

export const metadata: Metadata = { title: "Document" };

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const loaded = await loadDocument(params, searchParams);
  if (!loaded) notFound();
  const { userId, proj, doc, versions, selected } = loaded;

  const shares = await listActiveShareLinks(userId, selected.id);

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
                    href={documentPath(proj.slug, doc.slug, doc.kind, x.number)}
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
                <p className="text-xs text-muted">
                  None issued. A share link opens this revision without signing in.
                </p>
              )}
              {shares.map((s) => (
                <div key={s.id} className="space-y-1.5 border border-line bg-panel-2 p-2.5">
                  <p className="font-mono text-xs text-muted">created {formatDate(s.createdAt)}</p>
                  <form action={revokeShareLink.bind(null, s.id)}>
                    <button className="stamp cursor-pointer text-stamp hover:bg-stamp hover:text-paper transition-colors">
                      Revoke
                    </button>
                  </form>
                </div>
              ))}
              <CreateShareLinkForm versionId={selected.id} />
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
