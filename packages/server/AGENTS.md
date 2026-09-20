# Server harness

Applies to `packages/server/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- [README.md](README.md): onboarding, domain map, request flows and verification guide.

- `index.ts`: utility-process adapter; `runtime.ts`: host-independent startup/shutdown; only `startServer` is exported, returning only `port`, `registerGrant` and `close`.
- `http/server.ts`: shared authentication, error mapping and HTTP response adaptation; `http/` registers business domains.
- `projects/project-service.ts`: project use-case facade and orchestration; directory grants, manifest store, scaffold and source modules own grants, manifest changes, initialization and generated source respectively.
- `schema/schema-service.ts`: authoritative edit pipeline and per-page serialization. Working v2 separates the mutable, automatically retained draft (`workingVersion`/`workingHash`) from explicit immutable Revision checkpoints. `schema/schema-commit.ts` owns checkpoint commit/recovery and v1 Working-file upgrade under that page queue; `schema/schema-hash.ts` owns pure hashing. `schema/working-schema-store.ts` owns Working/Revision/journal paths and atomic JSON persistence.
- `schema/project-apply-service.ts`: apply orchestration. Initial target creation and explicit apply must share one Target Schema Store; explicit Apply accepts only the current saved Revision when Working is clean and checks both Revision and Working version. `ProjectService` must not retain a separate target `schema.json` writer.
- `origamix.project.json.pages` is the project page standard and `pageDirectory` locates those pages below `src/`. `pageId` is the stable identity; opening a project may complete missing top-level manifest fields from the validated open request and rebuild the SQLite index, but SQLite must never rewrite the manifest.
- `schema/material-validation.ts`: pure-data Materials Manifest enforcement before Schema writes.
- Domain-local `*-repository.ts` files and `database/`: Drizzle over `node:sqlite`, current-schema initialization and safety checks.
- `template.ts`: clean scaffold copying; `scripts/`: Server-owned builds and integration checks.
- `tooling.ts`: separate export entry for `evaluation/` (Agent evaluation, capability probes, privacy evidence and internal-release thresholds). `testing/` owns deterministic engines and test fixtures; these are not exported by the host runtime. The MVP updates callers directly and does not retain compatibility aliases.
- `agent/agent-service.ts` is the sole Run startup/dispatch path; `agent/run-executor.ts` executes prepared Runs, while `agent/run-service.ts` owns state transitions; `agent/tools/` owns tool policy and implementations. `conversations/` owns messages and conversation transactions. `diagnostics/` owns validation and the process-local diagnostic cache.

- `infrastructure/` owns reusable keyed queues and atomic file replacement. Queue instances retain domain scope; callers retain path authorization and directory creation.

## Service and security boundaries

- Keep HTTP → services → repositories/filesystem ownership explicit. Do not add business mutations in transport or Electron Main. Server remains usable without Electron/React imports.
- Keep HTTP registration split by Project, Schema, Apply, Runtime and Agent domains; share authentication, project context, error mapping and response envelopes instead of duplicating them in route files.
- Server must not own browser-window navigation state such as the selected project, open/active tabs, per-tab mode or drafts. Those are App `sessionStorage` concerns in both browser and desktop hosts.
- Server may consume the declared, serializable `@origamix/materials/*/manifest` exports for validation; it must not import material runtime components or editor modules.
- Listen only on `127.0.0.1` with an assigned port. Preserve bearer-token, service-instance and Origin checks; CORS alone is not authorization. Directory grants come from the trusted host, never an arbitrary-path HTTP endpoint.
- Validate payloads and project/page ownership before filesystem access. Resolve paths inside the authorized project and reject traversal/symlink escapes; client IDs/display paths are not authority.
- HTTP JSON uses `{ success, code, data, message? }`: successful bodies use `code: 200`; failures use `data: null` and an HTTP/business code. Keep the HTTP status RESTful and expose request IDs through response headers.
- Use shared TypeBox contracts and runtime validators. Return actionable, redacted errors with request IDs; never log tokens, keys or full private project content.
- Agent HTTP/SSE streaming is implemented in `http/agent-routes.ts`. HTTP/SSE preview capabilities remain target work; do not bypass authentication for a new client.

## Persistence invariants

- SQLite holds application records/indexes; Working Schema and Revision files are authoritative editable page data. Keep initialization, edits and undo in `schema/schema-service.ts`. Applied target Schema is a managed projection: saving, undoing or completing an Agent Run must not write it implicitly.
- Visual-editor draft updates normally submit typed Operation Batches with an expected Working version; the internal complete-candidate endpoint remains a fallback for changes the current operation protocol cannot represent safely. Agent edits submit typed `apply_page_operations` batches bound to the Run's starting Working version. Both paths validate the final candidate and atomically replace the sole Working file without creating a Revision. Explicit save-version creates an immutable full-schema checkpoint and is idempotent when Working already matches the latest saved checkpoint. Preserve valid data on rejection/failure.
- External target changes must not be imported during reconciliation. Reloading from the project is an explicit, confirmed operation that replaces the affected page's Working Schema; missing, moved or invalid manifest-owned files stop only that page's operation with an actionable error. Do not scan for a guessed replacement path, silently recreate files or overwrite user changes.
- A single-file rename does not make multiple files plus SQLite one transaction. Changes to this path need explicit recovery/concurrency tests; do not claim existing code is crash-safe solely because it uses atomic rename.
- **No `FOREIGN KEY`, `REFERENCES`, cascading deletes or updates in the schema.** Keep generated-DDL and live-database safety checks effective; do not disable checks or hide equivalent relationships in triggers.
- Services enforce parent existence, ownership, deletion order and orphan handling. Use indexes, uniqueness constraints and SQL transactions for related database changes.
- `database/schema.ts` is the table-model source of truth. This MVP codebase has no migration chain: initialize empty databases from the current schema, preserve matching databases on reopen and automatically rebuild incompatible SQLite files. Revisit this destructive reset policy before retaining user-authored database data across releases.
- `template.ts` uses an allowlist. Exclude dependencies, generated output, secrets, caches and symlinks. Only the two prepared `vendor/runtime.tgz` and `vendor/materials.tgz` archives are copied from vendor; new scaffold assets require deliberate allowlist changes/tests, not copying the entire tree.
- Stop listeners and close databases on failed startup, restart and exit. Use package-owned build scripts/exports; generated artifacts are not source.

## Mechanical boundaries

- `scripts/eslint-boundaries.mjs` is loaded by the root ESLint configuration for Server TypeScript. It rejects runtime imports of test/evaluation/UI modules, upward business → HTTP/startup dependencies, direct HTTP/tool persistence dependencies, and value imports of Schema internals outside their named owners. Type-only references to domain contracts are allowed.
- `http/types.ts` exposes only repository reads and the required service methods; tools receive narrow repository/diagnostic interfaces. Keep these capabilities narrow when adding routes/tools.
- `runtime.ts` exports only local `startServer`; the rule and isolated bundle test enforce this. Update callers directly in the MVP.
- These are static import/type checks, not a security sandbox or proof of all runtime effects. Runtime authorization and persistence tests remain required. The rule covers static imports, re-exports, literal dynamic imports and direct `require`; computed module paths are rejected in checked production files.

## Verification

From the repository root:

```sh
pnpm --filter @origamix/server lint
pnpm --filter @origamix/server typecheck
pnpm --filter @origamix/server test
pnpm --filter @origamix/server build
pnpm --filter @origamix/server gate:agent
```

- Server owns most automated coverage. Use `test/http/agent-schema-flow.test.ts` for a small number of Agent → Working → Revision → Apply paths, service tests for business rules and persistence, and HTTP tests for authentication, request adaptation and representative error mapping. Do not exhaustively repeat a service rule at the HTTP layer.
- Prefer modifying an existing core-flow scenario. Add a new scenario only for an uncovered integrity, authorization, conflict, concurrency or recovery risk, and state why current coverage cannot express it.
- Use temporary directories/databases and fake secrets. Never migrate real app databases or overwrite existing user projects in tests.
- Template/copy changes: `pnpm --filter @origamix/server test:template` (registry access or populated cache required).
- Development/build lifecycle changes: `pnpm --filter @origamix/server test:dev`; host changes may also need App `test:web` and Desktop `test:main` after root build.
- Run root gates before handoff. Name uncovered failure/concurrency cases; passing current tests does not prove crash-safe multi-file transactions.
