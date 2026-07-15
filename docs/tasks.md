# Follow-up tasks

Keep this file limited to evidence-backed work. Move completed outcomes into `docs/current-state.md` and remove finished checklist items instead of building a changelog here.

## Active

- [ ] Review and merge the validated `refactor/structure-best-practices` worktree when ready.
- [ ] Obtain explicit approval and confirm the target before running `bun run db:migrate` against a remote database.

## Next

- [ ] Verify the production runtime uses a dedicated least-privilege database role after the remote target and review window are explicitly approved; do not add role SQL to repository migrations.
- [ ] Run a browser-based axe audit of login, API-token, document, share, and mutation-result states when a disposable authenticated browser environment is available.
- [ ] Review expired session, verification, and rate-limit row counts after production use; add scheduled cleanup only if Better Auth's normal cleanup leaves sustained growth.

## Scale triggers

- [ ] Capture production-like `EXPLAIN (ANALYZE, BUFFERS)` evidence before adding indexes, caching, or cursor pagination; reassess when a document exceeds 200 versions, a project reaches hundreds of documents, or page-query p95 exceeds 300 ms.
- [ ] Reassess postgres-js pool limits only if connection utilization exceeds 70%, connection errors appear, or cold-start connection spikes are measured.
- [ ] Add storage accounting before retention or object-storage work; reassess when stored HTML exceeds 1 GB, monthly growth exceeds 250 MB, or backup/restore time exceeds 15 minutes.
- [ ] Change frontend loading only when Web Vitals or Lighthouse evidence shows a regression after the current lazy iframe and image-preload improvements.

## Maintenance

- [ ] Update `docs/current-state.md` when the refactor merges, recording only verified behavior and removing the unmerged-work section.
- [ ] Keep this task list synchronized with active repository work; do not infer priorities from abandoned branches or local-only state.
- [ ] Update `README.md` when setup, ingest API, deployment, or security behavior changes.
- [ ] Re-run the documentation reference and public-safety checks whenever routed files or repository layout change.
