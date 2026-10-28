# Server harness

Applies to `packages/server/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- [README.md](README.md): onboarding, domain map, request flows and verification guide.

- `src/hosts/utility-process.ts`: utility-process adapter; `src/server.ts`: host-independent startup/shutdown; only `startServer` is exported, returning only `port`, `registerGrant` and `close`.
- `/projects/list` returns active projects with their active `pages` records for one-request workspace restoration; page lists remain available for page-scoped refreshes.
- `src/http/server.ts`: shared authentication, error mapping and HTTP response adaptation; `src/http/` registers business domains.
- `src/projects/project-service.ts`: project use-case facade and orchestration; directory grants, manifest store, scaffold and source modules own grants, manifest changes, initialization and generated source respectively.
- `src/projects/project-materials.ts` is the concrete pure-data catalog assembly point for validation and Agent tools/context. ProjectManifestStore resolves the Shared project stack on reads without rewriting files; incomplete manifests fail without being rewritten. Explicit unsupported stacks fail before writes. `projects/stack/get` checks active project and manifest identity; no database copy of stack metadata is authoritative.
- `src/schema/schema-service.ts`: authoritative edit pipeline and per-page serialization. Working v2 separates the mutable, automatically retained draft (`workingVersion`/`workingHash`) from explicit immutable Revision checkpoints. `src/schema/revision-commit.ts` owns checkpoint commit/recovery under that page queue; `src/schema/schema-hash.ts` owns pure hashing. `src/schema/working-schema-store.ts` owns Working/Revision/journal paths and atomic JSON persistence.
- `src/schema/project-apply-service.ts`: apply orchestration. Initial target creation and explicit apply must share one Target Schema Store; explicit Apply accepts only the current saved Revision when Working is clean and checks both Revision and Working version. `ProjectService` must not retain a separate target `schema.json` writer.
- Agent element summaries expose alias-or-`elementId（Manifest title）` labels; terminal clarification candidates derive labels from the checked Working Schema, while candidate identity and authority remain bound to element IDs and Working versions.
- `origamix.project.json.pages` is the project page standard and `pageDirectory` locates those pages below `src/`. `pageId` is the stable identity; opening a project requires a complete current manifest and may rebuild the SQLite index, but SQLite must never rewrite the manifest.
- `src/schema/validation/material-validation.ts`: pure-data Materials Manifest enforcement before Schema writes. Server bundles the compiled Materials Manifest; after material contract changes, follow the explicit build and runtime reload workflow in [Materials guidance](../materials/AGENTS.md#required-build-workflow).
- Flow-node parameters must match the Shared current contract before HyperValue expressions/functions are accepted. This allowance applies only to checked flow parameters; material props retain their existing executable-content and URL checks. Server validates configuration without compiling or executing project JavaScript.
- `src/schema/validation/flow-reference-validation.ts` checks page-local element/property/method/variable, independent context.variables/context.writable capabilities and explicit HyperValue/event.payload references against Materials. Drafts may retain disconnected nodes and empty targets. The Working service requires completeness for flows explicitly submitted or newly bound by an Agent commit (even unchanged submissions), including reachability and result dependencies; unrelated retained visual drafts remain editable. Event-specific set/remove operations preserve other bindings and never delete a shared flow implicitly.
- Domain-local `*-repository.ts` files and `src/database/`: Drizzle over `node:sqlite`, current-schema initialization and safety checks.
- `src/templates/copy-template.ts`: clean scaffold copying; `scripts/`: Server-owned builds and integration checks.
- `src/tooling.ts`: separate export entry for `src/evaluation/` (Agent evaluation, capability probes, privacy evidence and internal-release thresholds). `test/fixtures/` owns deterministic engines and test fixtures; these are not exported by the host runtime. Update internal API callers together; do not retain compatibility aliases.
- `gate:agent` checks synthetic recorded evaluation fixtures and thresholds only; it does not measure live provider quality, runtime security or resource release. Keep its evidence labels explicit. Live page quality runs belong to Desktop `evaluate:agent`, where the existing Main credential boundary can be exercised without exporting credentials.
- `src/agent/agent-service.ts` is the sole Run startup/dispatch path; `src/agent/run-executor.ts` executes prepared Runs, while `src/agent/run-service.ts` owns state transitions; `agent/tools/` owns tool policy and implementations. `src/conversations/` owns messages and conversation transactions. `src/diagnostics/` owns validation and the process-local diagnostic cache.
- `src/agent/tools/logic-tools.ts` exposes Run-scoped exact logic reads through the existing read-only tool assembly: `get_page_logic_context`, `get_event_flow`, `get_flow_node_manifest`. Large results use contiguous JSON text chunks with Working version, offsets and total length; never compact code or nested flow data. `src/agent/flow-guidance.ts` owns generation rules. Context logic summaries are bounded hints, not complete flow facts. New Runs record prompt version 3 and toolset version 2.
- Schema validation errors expose code/path and, where attributable, operation index through `SchemaValidationError`; terminal tools return JSON repair feedback to the model. Only pre-write validation failures enter repair. The executor retains the previous bounded submission in memory for a new model invocation; never add full submissions to tool audits or SSE. Conflicts and ambiguous persistence failures must not replay a batch.

- `src/infrastructure/` owns reusable keyed queues and atomic file replacement. Queue instances retain domain scope; callers retain path authorization and directory creation.

## Service and security boundaries

- Keep HTTP → services → repositories/filesystem ownership explicit. Do not add business mutations in transport or Electron Main. Server remains usable without Electron/React imports.
- Keep HTTP registration split by Project, Schema, Apply, Runtime and Agent domains; share authentication, project context, error mapping and response envelopes instead of duplicating them in route files.
- Server must not own browser-window navigation state such as the selected project, open/active tabs, per-tab mode or drafts. Those are App `sessionStorage` concerns in both browser and desktop hosts.
- Server may consume the declared, serializable `@origamix/materials/*/manifest` exports for validation; it must not import material runtime components or editor modules.
- Listen only on `127.0.0.1` with an assigned port. Preserve bearer-token, service-instance and Origin checks; CORS alone is not authorization. Directory grants come from the trusted host, never an arbitrary-path HTTP endpoint.
- `src/schema/metadata-path.ts` checks every existing metadata path component before Working, Revision, journal, Agent receipt and Apply receipt access; reject symlinks, including leaf files, before creating directories or writing. Keep this check on reads and cleanup as well as writes.
- Project manifest read-modify-write operations (including project/page rename) and their index reconciliation share the project queue in `project-service.ts`.
- Validate payloads and project/page ownership before filesystem access. Resolve paths inside the authorized project and reject traversal/symlink escapes; client IDs/display paths are not authority.
- JSON business routes are named POST operations; take project/page scope, resource IDs and pagination from validated request bodies. Agent SSE and health checks remain GET. Keep service-level ownership checks for pages, conversations and Runs.
- HTTP JSON uses `{ success, code, data, message? }`: successful bodies use `code: 200`; failures use `data: null` and an HTTP/business code. Keep the HTTP status RESTful and expose request IDs through response headers.
- Use shared TypeBox contracts and runtime validators. Return actionable, redacted errors with request IDs; never log tokens, keys or full private project content.
- Agent HTTP/SSE streaming is implemented in `src/http/agent-routes.ts`. HTTP/SSE preview capabilities remain target work; do not bypass authentication for a new client.
- The desktop host owns model selection and credentials. Resolve its current supported model reference before starting a new Agent Run, validate it against the Server registry and persist it on the Run; retries and execution use that persisted reference rather than re-reading settings.

## Persistence invariants

- SQLite holds application records/indexes; Working Schema and Revision files are authoritative editable page data. Keep initialization, edits and undo in `src/schema/schema-service.ts`. Applied target Schema is a managed projection: saving, undoing or completing an Agent Run must not write it implicitly.
- Visual-editor draft updates normally submit typed Operation Batches with an expected Working version; the internal complete-candidate endpoint remains a fallback for changes the current operation protocol cannot represent safely. Agent edits submit their complete typed Operation Batch only through `complete_page_run`, bound to the Run's starting Working version. Both paths validate the final candidate and atomically replace the sole Working file without creating a Revision. Explicit save-version creates an immutable full-schema checkpoint and is idempotent when Working already matches the latest saved checkpoint. Preserve valid data on rejection/failure.
- External target changes must not be imported during reconciliation. Reloading from the project is an explicit, confirmed operation that replaces the affected page's Working Schema; missing, moved or invalid manifest-owned files stop only that page's operation with an actionable error. Do not scan for a guessed replacement path, silently recreate files or overwrite user changes.
- A single-file rename does not make multiple files plus SQLite one transaction. Changes to this path need explicit recovery/concurrency tests; do not claim existing code is crash-safe solely because it uses atomic rename.
- Agent Working writes use page-owned durable receipts under `.origamix/pages/<pageId>/agent-commits/`: prepare the receipt before replacing Working, then mark it committed afterward. Startup recovery may reconcile an active Run only when receipt scope, Operation digest, Working version and Working hash agree; it never replays Operations or resumes a model request. Receipts remain as audit/recovery evidence for the lifetime of the page and are removed with that page; do not introduce an independent cleanup path.
- Agent tool audits persist only safe metadata: tool/phase/timing/error classification and Operation count/type/digest. Never persist full tool arguments, Schema, model context or credentials in audit rows. Run failure stages and recovered-commit markers must remain sufficient to distinguish protocol, validation, commit and recovery failures.
- **No `FOREIGN KEY`, `REFERENCES`, cascading deletes or updates in the schema.** Keep generated-DDL and live-database safety checks effective; do not disable checks or hide equivalent relationships in triggers.
- Services enforce parent existence, ownership, deletion order and orphan handling. Use indexes, uniqueness constraints and SQL transactions for related database changes.
- `src/database/schema.ts` is the table-model source of truth. All six business tables have autoincrement integer `id` primary keys, and inter-table references use those keys. Projects, pages and Agent Runs also keep unique string `project_id`, `page_id` and `run_id` for project files and external requests. Conversation and message API IDs are derived from their integer keys. Database startup uses `src/database/migrations.ts`: current-schema initialization, pre-upgrade backup, transactional ordered steps and newer-version rejection; unknown structures fail without reset.
- `src/templates/copy-template.ts` uses an allowlist. Exclude dependencies, generated output, secrets, caches and symlinks. Do not copy vendor archives; new scaffold assets require deliberate allowlist changes/tests, not copying the entire tree.
- Stop listeners and close databases on failed startup, restart and exit. Use package-owned build scripts/exports; generated artifacts are not source.

## Mechanical boundaries

- Materials exposes compiled declarations in the workspace and published package; build it before isolated Server typechecks. Runtime imports remain restricted to the pure-data Manifest entry.

- `scripts/eslint-boundaries.mjs` is loaded by the root ESLint configuration for Server TypeScript. It rejects runtime imports of test/evaluation/UI modules, upward business → HTTP/startup dependencies, direct HTTP/tool persistence dependencies, and value imports of Schema internals outside their named owners. Type-only references to domain contracts are allowed.
- `src/http/types.ts` exposes only repository reads and the required service methods; tools receive narrow repository/diagnostic interfaces. Keep these capabilities narrow when adding routes/tools.
- `src/server.ts` exports only local `startServer`; the rule and isolated bundle test enforce this. Update callers together when changing internal APIs.
- These are static import/type checks, not a security sandbox or proof of all runtime effects. Runtime authorization and persistence tests remain required. The rule covers static imports, re-exports, literal dynamic imports and direct `require`; computed module paths are rejected in checked production files.

## Verification

From the repository root:

```sh
pnpm --filter @origamix/server lint
pnpm --filter @origamix/materials... build
pnpm --filter @origamix/server typecheck
pnpm --filter @origamix/server test
pnpm --filter @origamix/server build
pnpm --filter @origamix/server gate:agent
```

- Server owns most automated coverage. Use `test/http/agent-schema-flow.test.ts` for a small number of Agent → Working → Revision → Apply paths, service tests for business rules and persistence, and HTTP tests for authentication, request adaptation and representative error mapping. Do not exhaustively repeat a service rule at the HTTP layer.
- Prefer modifying an existing core-flow scenario. Add a new scenario only for an uncovered integrity, authorization, conflict, concurrency or recovery risk, and state why current coverage cannot express it.
- Use temporary directories/databases and fake secrets. Never migrate real app databases or overwrite existing user projects in tests.
- Template/copy changes: `pnpm --filter @origamix/server test:template` (registry access or populated cache required).
- Template smoke covers compiled HTTP draft recovery across restart, explicit save/Apply, stable page shells and standalone installation/build. `ORIGAMIX_KEEP_TEMPLATE_SMOKE=1` retains only its newly created temporary project for graphical checks; default cleanup remains enabled. Keep render evidence separate from build success.
- Development/build lifecycle changes: `pnpm --filter @origamix/server test:dev`; host changes may also need App `test:web` and Desktop `test:main` after root build.
- Run root gates before handoff. Name uncovered failure/concurrency cases; passing current tests does not prove crash-safe multi-file transactions.

- Material semantics additionally reject duplicate identifiers, orphan tab content/default-node references, invalid canonical dates/ranges and duplicate Form field names before a Working write. Keep source rejection atomic; do not rewrite retained projects to hide removed property or enum errors.

## Version upgrades

- `schema/schema-migrations.ts` is the only pure Schema conversion chain. `schema-service.ts` upgrades on page access under the existing page queue; never persist intermediate steps or write the target. Current producers use Shared `ORIGAMIX_VERSION`. Old Revision hashes refer to original bytes/data; restore converts a candidate without rewriting history.
- Project reconciliation indexes manifest pages without opening them. The first page access imports retained target data if Working is absent. Agent startup receipt recovery uses `getRetainedWorkingSchemaState`, which must not trigger migration before checking the durable commit hash.
- `origamix.project.json` has one `version` and a material-set ID; resolved stack component versions are derived. New projects use the current descriptor. Unknown/missing versions and unsupported descriptors are rejected without normalization.
- Applying a current Schema to a project declaring another runtime release is blocked. Project dependency changes are explicit and must coordinate all saved/applied pages; opening a page must never rewrite dependencies.
- Release updates use root `release:version`; its check enforces package alignment and adjacent Schema migration declarations. Database storage versions advance only for actual database changes, with migrations supplied before enabling that version.

- `projects/project-upgrade-service.ts` runs explicit whole-project upgrades under ProjectService's project queue, with a durable `project-upgrade.json` plan. It accepts only already-opened, clean saved pages; target writes go through ProjectApplyService with stable per-page request IDs. Ordinary Working/manifest writes and Apply reject pending upgrades. Never auto-resume at startup, execute a package manager, or rewrite page shells. Cancellation requires unchanged targets and configuration.

- `scripts/config.mjs` owns independent Server dev env loading. Hosted startServer remains parameter-injected and must not read environment files. Credentials remain process-injected, relative paths are package-root-relative, and tests disable personal overrides with ORIGAMIX_ENV_LOCAL=0.

## Source organization

- `src/` contains production code. `src/server.ts` is the host-independent composition entry; `src/hosts/utility-process.ts` is the Electron control-port adapter. Public package subpaths and built artifact names remain unchanged.
- `src/schema/schema-contracts.ts` owns internal service input/result types; `validation/schema-validation.ts` owns final candidate validation and its error type; `working-schema-result.ts` owns the pure response projection. Keep the single page queue and all durable write/recovery sequencing in schema-service.ts.
- `src/schema/validation/` separates shared validation contracts, property/value safety, material semantics, flow-reference checks and the aggregate material-validation entry. Preserve error ordering and Agent executable-flow completeness checks.
- `src/projects/page-directory.ts` owns page directory normalization/authorization checks; `initial-page-schema.ts` builds the initial schema. ProjectService still owns project queue orchestration.
- Root `scripts/` owns build/development tools; `test/fixtures/` and `test/helpers/` own test fixtures and utilities within `test/`. Do not import them from production business code. Directory moves must update the architecture rule and its fixtures, release-version script, build/watch entries and Drizzle schema paths together.

- Package `build` compiles only Server; prepare Materials first (or use root `build`). `test` runs schema and architecture checks without an implicit build. Root `test:template` prepares library and Server artifacts for the independent template check; package-local integration/evaluation commands consume existing artifacts.

- Independent Server/Web development and Desktop share `scripts/development-libraries.mjs` for library watch paths and ordered builds. Web/Server prepare libraries on startup and rebuild source changes before replacing the host. Failed builds retain the running host; save a watched source to retry. Tooling script changes require restarting the launcher.

- Build and publication ownership follows [package artifact contract](../../site/docs/architecture/development.md). Materials npm output contains only public runtime/Manifest artifacts; UI/Editor stay private. Template dependencies use exact registry versions, never production vendor archives.
