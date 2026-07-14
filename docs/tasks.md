# Follow-up tasks

Keep this file limited to evidence-backed work. Move completed outcomes into `docs/current-state.md` and remove finished checklist items instead of building a changelog here.

## Active

- [ ] Finish the `refactor/structure-best-practices` work without broadening its current behavior boundary.
- [ ] Review centralized queries and ownership helpers for consistent per-user filtering and share-token authorization.
- [ ] Confirm environment validation matches `.env.example` and remains compatible with local development and Vercel.
- [ ] Review shared document-kind and URL helpers against every plan/report route and selected-version link.
- [ ] Reconcile the new schema indexes with the generated Drizzle migration and inspect the SQL before applying it anywhere.
- [ ] Read the relevant bundled Next.js guides for every changed route, page, layout, cache, and server-action API.
- [ ] Run `bun run lint` and `bun run build` with a valid local environment, then exercise login, ingest, browse, share, revoke, view, and download flows.
- [ ] Obtain explicit approval and confirm the target before running `bun run db:migrate` against a remote database.

## Next

- [ ] Add automated ingest coverage for missing or revoked bearer tokens, malformed JSON, schema validation, document creation/update, and version allocation under contention.
- [ ] Add automated viewer coverage for owner sessions, active shares, revoked or mismatched shares, missing versions, download headers, CSP, and private caching.
- [ ] Add authorization coverage for API-token and share-link creation/revocation so mutations cannot cross user boundaries.
- [ ] Add the chosen test command to `package.json` and route the resulting workflow from `AGENTS.md` after the test stack exists.

## Maintenance

- [ ] Update `docs/current-state.md` when the refactor merges, recording only verified behavior and removing the unmerged-work section.
- [ ] Keep this task list synchronized with active repository work; do not infer priorities from abandoned branches or local-only state.
- [ ] Update `README.md` when setup, ingest API, deployment, or security behavior changes.
- [ ] Re-run the documentation reference and public-safety checks whenever routed files or repository layout change.
