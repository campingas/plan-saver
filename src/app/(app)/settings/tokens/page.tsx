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

  const base = process.env.BETTER_AUTH_URL ?? "https://your-deployment.vercel.app";

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">API tokens</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Personal tokens let the html-planning skill upload documents to your archive. Tokens are
          stored hashed and shown only once at creation.
        </p>
      </div>

      <CreateTokenForm />

      {tokens.length > 0 && (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className={`font-medium ${t.revokedAt ? "text-zinc-400 line-through dark:text-zinc-600" : ""}`}>
                  {t.name}
                </span>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  created {formatDate(t.createdAt)} · last used {formatDate(t.lastUsedAt)}
                  {t.revokedAt && ` · revoked ${formatDate(t.revokedAt)}`}
                </p>
              </div>
              {!t.revokedAt && (
                <form action={revokeApiToken.bind(null, t.id)}>
                  <button className="text-sm text-red-600 hover:underline dark:text-red-400">
                    Revoke
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Machine setup</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Save your token where the skill reads it:
        </p>
        <pre className="overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
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
