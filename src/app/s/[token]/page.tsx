import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSharedVersion } from "@/db/queries";
import { KindBadge } from "@/components/kind-badge";

type Params = Promise<{ token: string }>;

export const metadata: Metadata = { title: "Shared document" };

export default async function SharedVersionPage({ params }: { params: Params }) {
  const { token } = await params;

  const row = await getSharedVersion(token);
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
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <a
          href={`/api/view/${row.versionId}?share=${encodeURIComponent(token)}&download=1`}
          className="eyebrow hover:text-accent transition-colors"
        >
          ↓ Download raw HTML
        </a>
        <a
          href={`/api/view/${row.versionId}?share=${encodeURIComponent(token)}&download=markdown`}
          className="eyebrow hover:text-accent transition-colors"
        >
          ↓ Download raw Markdown
        </a>
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
