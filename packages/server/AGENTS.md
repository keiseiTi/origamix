# Server harness

Applies to `packages/server/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- `index.ts`: utility-process adapter; `runtime.ts`: host-independent startup/shutdown.
- `transport/http/server.ts`: authentication, validation and HTTP adaptation.
- `services/project-service.ts`, `services/schema-service.ts`: project lifecycle and Schema/revision files.
- `services/schema-material-validation.ts`: pure-data Materials Manifest enforcement before Schema writes.
- `repositories/`, `database/`: SQLite access, migrations and safety checks.
- `template.ts`: clean scaffold copying; `scripts/`: Server-owned builds and integration checks.

## Service and security boundaries

- Keep HTTP → services → repositories/filesystem ownership explicit. Do not add business mutations in transport or Electron Main. Server remains usable without Electron/React imports.
- Server must not own browser-window navigation state such as the selected project, open/active tabs, per-tab mode or drafts. Those are App `sessionStorage` concerns in both browser and desktop hosts.
- Server may consume the declared, serializable `@origamix/materials/*/manifest` exports for validation; it must not import material runtime components or editor modules.
- Listen only on `127.0.0.1` with an assigned port. Preserve bearer-token, service-instance and Origin checks; CORS alone is not authorization. Directory grants come from the trusted host, never an arbitrary-path HTTP endpoint.
- Validate payloads and project/page ownership before filesystem access. Resolve paths inside the authorized project and reject traversal/symlink escapes; client IDs/display paths are not authority.
- HTTP JSON uses `{ success, code, data, message? }`: successful bodies use `code: 200`; failures use `data: null` and an HTTP/business code. Keep the HTTP status RESTful and expose request IDs through response headers.
- Use shared TypeBox contracts and runtime validators. Return actionable, redacted errors with request IDs; never log tokens, keys or full private project content.
- HTTP/SSE preview capabilities and Agent streaming in the ADR are target work. Do not claim endpoints exist or bypass authentication for a new client.

## Persistence invariants

- SQLite holds application records/indexes; project Schema and Revision files are authoritative page data. Keep Schema initialization, edits and undo in `services/schema-service.ts`.
- Normal edits validate ChangeSet, match page/base revision, validate candidates, create Revision and write atomically. Preserve valid data on rejection/failure.
- A single-file rename does not make multiple files plus SQLite one transaction. Changes to this path need explicit recovery/concurrency tests; do not claim existing code is crash-safe solely because it uses atomic rename.
- **No `FOREIGN KEY`, `REFERENCES`, cascading deletes or updates in migrations.** Keep `assertMigrationSafety` and tests effective; do not disable checks or hide equivalent relationships in triggers.
- Services enforce parent existence, ownership, deletion order and orphan handling. Use indexes, uniqueness constraints and SQL transactions for related database changes.
- Append migrations instead of rewriting applied versions. Test migration/reopen with temporary databases and retain a recovery path for file/index inconsistencies.
- `template.ts` uses an allowlist. Exclude dependencies, generated output, secrets, caches and symlinks. New scaffold assets require deliberate allowlist changes/tests, not copying the entire tree.
- Stop listeners and close databases on failed startup, restart and exit. Use package-owned build scripts/exports; generated artifacts are not source.

## Verification

From the repository root:

```sh
pnpm --filter @origamix/server lint
pnpm --filter @origamix/server typecheck
pnpm --filter @origamix/server test
pnpm --filter @origamix/server build
```

- Extend `database/database.test.ts`, `services/schema-service.test.ts` and `transport/http/server.test.ts` for affected boundaries. Cover invalid input, stale revisions, cross-project access, authentication and recovery.
- Use temporary directories/databases and fake secrets. Never migrate real app databases or overwrite existing user projects in tests.
- Template/copy changes: `pnpm --filter @origamix/server test:template` (registry access or populated cache required).
- Development/build lifecycle changes: `pnpm --filter @origamix/server test:dev`; host changes may also need App `test:web` and Desktop `test:smoke` after root build.
- Run root gates before handoff. Name uncovered failure/concurrency cases; passing current tests does not prove crash-safe multi-file transactions.
