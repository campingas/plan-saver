import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiToken } from "@/db/schema";
import { CreateTokenForm } from "@/components/create-token-form";
import { revokeApiToken } from "@/lib/actions";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";

export default async function TokensPage() {
  const session = await requireSession();

  const tokens = await db
    .select()
    .from(apiToken)
    .where(eq(apiToken.userId, session.user.id))
    .orderBy(desc(apiToken.createdAt));

  const base = process.env.BETTER_AUTH_URL ?? "https://plan-saver.vercel.app";

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="display text-[34px]">API tokens</h1>
        <p className="text-sm text-muted">
          A token lets the html-planning skill file documents into this archive. Tokens are stored
          hashed and shown once, at creation.
        </p>
      </div>

      <CreateTokenForm />

      {tokens.length > 0 && (
        <div className="border border-line-strong bg-panel">
          <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-b border-line-strong px-5 py-2.5 sm:grid-cols-[1fr_auto_auto]">
            <span className="eyebrow">Token</span>
            <span className="eyebrow hidden text-right sm:block">Last used</span>
            <span className="eyebrow text-right">Status</span>
          </div>
          {tokens.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-[1fr_auto] items-center gap-x-6 border-b border-line px-5 py-3.5 last:border-b-0 sm:grid-cols-[1fr_auto_auto]"
            >
              <div>
                <span className={`font-medium ${t.revokedAt ? "text-muted line-through" : "text-ink"}`}>
                  {t.name}
                </span>
                <p className="font-mono text-xs text-muted">created {formatDate(t.createdAt)}</p>
              </div>
              <span className="hidden font-mono text-sm text-muted sm:block">
                {formatDate(t.lastUsedAt)}
              </span>
              {t.revokedAt ? (
                <span className="stamp text-muted">revoked</span>
              ) : (
                <form action={revokeApiToken.bind(null, t.id)} className="text-right">
                  <button className="stamp cursor-pointer text-stamp hover:bg-stamp hover:text-paper transition-colors">
                    Revoke
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="eyebrow">Machine setup</h2>
        <p className="text-sm text-muted">Save the token where the skill reads it:</p>
        <pre className="overflow-x-auto border border-line bg-panel-2 p-4 font-mono text-xs leading-relaxed text-ink">
          {`mkdir -p ~/.config/plan-saver
cat > ~/.config/plan-saver/config.json <<'EOF'
{
  "url": "${base}",
  "token": "ps_live_…"
}
EOF`}
        </pre>
      </section>
    </div>
  );
}
