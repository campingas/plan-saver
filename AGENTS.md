# Plan-Saver

Plan-Saver is an authenticated archive for generated HTML plans and reports, organized by project, document, and version, with revocable sharing and sandboxed rendering.

## Read first

- Read `README.md` for product behavior, local setup, the ingest API, and the security model.
- Read `docs/current-state.md` before architecture, feature, database, or security work.
- Read `docs/tasks.md` before starting follow-up work and update it when task status changes.
- Read `docs/maintenance-window.md` before production migration or deployment work; it does not grant approval to execute remote steps.
- For routes and UI, start in `src/app/`; for authentication and server actions, start in `src/lib/`.
- For persistence changes, read `src/db/schema.ts`, `drizzle.config.ts`, and the matching files in `drizzle/`.

## Commands

- Install dependencies: `bun install`.
- Run locally: `bun run dev`.
- Run normal validation: `bun run lint`.
- Run explicit type validation: `bun run typecheck`.
- Run native tests with disposable PostgreSQL 17: `bun run test`.
- Run production validation: `bun run build`.
- Check migration metadata: `bun run db:check` with a nonempty `DIRECT_URL`.
- Check patch whitespace: `bun run diff:check`.
- Generate a migration after an intentional schema change: `bun run db:generate`.
- Apply migrations only after confirming the target database: `bun run db:migrate`.

## Safety boundaries

- Treat every stored HTML document as untrusted executable content.
- Preserve the dedicated `/api/view/[versionId]` response boundary, its restrictive CSP, and iframe sandboxing without `allow-same-origin`.
- Preserve owner checks and per-user query filters across documents, API tokens, versions, and share links.
- RLS intentionally has no Data API policies; do not weaken that boundary or change the runtime database role without a security review.
- Do not apply migrations to a remote database or trigger a deployment without explicit approval and a confirmed target.
- Keep credentials and environment values out of tracked docs; document variable names only.
- Update `docs/current-state.md`, `docs/tasks.md`, and `README.md` when their routed behavior or workflow changes.

## Next.js

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
