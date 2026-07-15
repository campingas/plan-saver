# Migration maintenance window

Use this runbook only after explicit approval for the named production target. It describes the operation but does not authorize a migration, deployment, database change, or Vercel pause.

## Prepare

1. Record the release commit, production URL, prepared deployment URL, Vercel project ID, and team ID in the change ticket.
2. Confirm the release contains migrations `0000` through `0003`, run `sha256sum drizzle/0001_misty_squadron_sinister.sql drizzle/0002_magenta_lethal_legion.sql drizzle/0003_share_token_hash_and_rate_limit.sql`, and compare the results with the protected digests `941a79b671903cbe306f094ad0a5c53fab34bb9c861db5c7c5ab4011b75241ed`, `43de10e6e3bcec2a1d6911a1abdded1d19e9f93a454986576bfaff62cb51784a`, and `90f0a357909c1dd3be5603d67e057b100f9abda24be3458c747f2131e379ed70`, respectively.
3. Run `bun install --frozen-lockfile && bun run lint && bun run typecheck && bun run test && bun run build && DIRECT_URL=postgresql://localhost/plan_saver_test bun run db:check && bun run diff:check` from a clean checkout of the release commit.
4. In the Supabase dashboard for the named production project, verify the latest successful backup or point-in-time recovery point, record its timestamp and retention, and confirm an operator has permission to restore it. Stop if the backup cannot be verified.
5. Load the approved production `DIRECT_URL`, then run the following non-connecting target check and compare its host, port, and database with the change ticket: `bun -e 'const u=new URL(process.env.DIRECT_URL ?? ""); if (!["postgres:","postgresql:"].includes(u.protocol) || u.port !== "5432") throw new Error("DIRECT_URL must be the confirmed PostgreSQL session-pooler URL on port 5432"); console.log({protocol:u.protocol,host:u.hostname,port:u.port,database:u.pathname.slice(1)})'`.
6. Build the release as a Vercel deployment without promoting it, record the immutable deployment URL, and smoke `GET /login` there. Do not start the window if the prepared deployment does not build or render.

## Pause and migrate

1. Announce the write outage and stop clients that call the ingest API.
2. Pause the Vercel project from its dashboard, confirm the pause, and verify that the production URL returns `503 DEPLOYMENT_PAUSED` before continuing; if the API must be used instead, supply its bearer token through a protected credential helper or standard input rather than a command-line argument.
3. Re-run the `DIRECT_URL` target check above, verbally confirm the project and database with the second operator, and run exactly `bun run db:migrate` once with the confirmed `DIRECT_URL` in the environment.
4. Inspect the migration output and confirm `0003_share_token_hash_and_rate_limit` is recorded. Do not edit the ledger or retry a partial failure without first diagnosing the database state.
5. Smoke the prepared deployment against production data while production remains paused: sign in with an allowed address, open an owned document, open a newly issued share URL in a private browser, revoke it and confirm it becomes unavailable, create and revoke an API token, ingest one disposable smoke document, and verify its owner viewer and download headers.

## Promote and resume

1. Promote the already-smoked immutable deployment to production while the project remains paused.
2. In Vercel project settings select `Resume Service`, confirm `Resume`, and wait for service restoration; do not create a second deployment during this step.
3. Confirm the production URL no longer returns `503`, then repeat the login, owned viewer, active/revoked share, API-token ingest, and download-header smoke checks against the production domain.
4. Confirm structured logs contain successful `ingest`, `viewer`, and `auth_email` events without HTML, authorization values, tokens, raw bodies, email URLs, or magic-link URLs.
5. Restart ingest clients, announce completion, and record the migration output, deployment ID, backup timestamp, smoke results, and window end time.

## Fix forward

Migration `0003` hashes and removes plaintext share tokens, so an older application release is not compatible after it succeeds. If migration or prepared-deployment smoke fails before `0003` completes, keep production paused and diagnose before any retry; if `0003` completes, keep production paused and deploy a reviewed fix forward. Restore from the verified backup only under explicit incident authority, and never attempt a down migration that recreates plaintext tokens.
