# Shared harness

Applies to `packages/shared/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- `src/index.ts` is the sole public entry. Organize its explicit exports by domain; domain directories do not create package subpaths or secondary barrels.
- `src/page/page-schema.ts` owns page/element/global-variable shapes, IDs and display labels. `schema-operation.ts` owns typed edits and batches; `page-api.ts` owns Working, Revision and Apply HTTP shapes; `page-validation.ts` owns structural/layout/binding validation.
- `src/project/` owns project/page manifests, installed stack resolution, project HTTP records/requests and explicit upgrade contracts. Concrete catalogs and module loaders do not belong here. Project manifests have one release version and a material-set ID; project versions must never be inferred from component metadata.
- `src/flow/flow-schema.ts` owns executable graphs/bindings; `flow-validation.ts` checks graph safety, including disconnected draft components. `flow-node-manifest.ts` owns pure-data node definitions, parameter schemas and derived types; `hyper-value.ts` owns serializable values/functions. Editor owns forms/layout; Runtime owns execution; Server owns persisted-data migration and material/Agent completeness checks.
- `src/agent/` separates run/budget/policy, messages/conversations, SSE events, HTTP requests, terminal outcomes/clarifications and evaluation contracts. `agent-schema.ts` holds shared protocol primitives; `runtime-report.ts` holds runtime observations consumed by Agent. `agent-validation.ts` lazily validates the envelopes and their specific payloads.
- `src/material/material-manifest.ts` owns material Manifest types and format version; concrete material catalogs and converters stay in Materials.
- `src/transport/` owns the API result envelope, named desktop bridge, credential gateway messages and read-only iframe preview snapshots/reports. `preview-message.ts` must never grant workbench capabilities to a preview.
- `src/version.ts` declares the unified release and supported release sequence.
- Tests mirror these domains under `test/`. Keep implementation imports relative with `.ts` suffixes; external consumers use only `@origamix/shared`.

## Contract rules

- This is platform-neutral contract code, published as an independent ESM package, not a runtime service or miscellaneous utility bucket. No Node.js, Electron, React, Fastify, browser globals or other workspace-package dependencies.
- Keep external behavior deterministic and side-effect-free: no filesystem/network calls, environment reads, credentials or process startup. `package.json` declares `sideEffects: false` so consumers can omit unused contract/validator modules; do not add import-time global registration or initialization side effects.
- Define runtime schemas alongside transport shapes and derive TypeScript types where practical. A cast cannot validate untrusted input; receiving boundaries must actually validate it.
- `getElementLabel` in `src/page/page-schema.ts` resolves editor labels to a nonblank `props.alias`, otherwise the supplied localized material title (falling back to `type`); `getAgentElementLabel` uses the alias or `elementId（localized material title）` for Agent references. It never changes the stable identity used by mutations or clarification selection.
- Preserve stable IDs, schemaVersion, operation discrimination, Working-version concurrency and error/result semantics. Breaking persisted formats need explicit version/migration strategy, not silently relaxed validation.
- Keep the HTTP result envelope in `src/transport/api-result.ts` synchronized with every producer and consumer; `data` is always present, and failures never place error metadata inside it.
- `isPageSchema` interprets the canonical PageSchema and reuses semantic checks without code generation for CSP-restricted design frames; HTTP validation retains detailed Ajv errors. Keep these paths on the same schema and semantic rules.
- Separate shape validation from semantic checks such as root existence, layout references and cycles. Never weaken validators to accept invalid fixtures/model responses.
- Review all App/Server/Desktop producers and consumers when changing exports. Keep preview contracts read-only and separate from workbench APIs.
- Consumers import only `@origamix/shared`. `src/index.ts` explicitly lists public value and type exports; internal modules import each other directly, never through the root barrel. Workspace and published exports both resolve compiled `dist`; `build` emits the single ESM entry and declarations to `dist`; keep workspace and published root exports synchronized and independently consumable. Relative source imports include `.ts` for internal Node 24 source tooling; the base TypeScript config rewrites extensions when emitting. Ajv instances and individual compiled validators initialize on first use and are cached; importing the root must not compile validators.

## Verification

From the repository root:

```sh
pnpm --filter @origamix/shared lint
pnpm --filter @origamix/shared typecheck
pnpm --filter @origamix/shared test
pnpm --filter @origamix/shared build
```

- Keep protocol tests representative rather than exhaustive. Prefer extending an existing positive/negative case; add a scenario only for a distinct compatibility, authorization or integrity risk not already enforced by the validator or a Server flow test.
- Run all root gates for downstream compilation and behavior; Shared passing alone is insufficient for a public-contract change.
- Root ESLint restrictions cover some platform imports, not the entire dependency graph. Review imports/manifests explicitly; do not describe architectural isolation as fully lint-enforced.

- Material context keeps independent variables (read), writable (runtime write), values (callable methods) and methods (events) declarations. Optional pure linkage metadata can control event visibility; it does not grant runtime access. `propsSchema` remains design-time validation, not a fallback capability source.

- Public page validation accepts only the current release contract; never loosen it to implement persisted-data migration.

- Build and publication ownership follows [package artifact contract](../../site/docs/architecture/development.md). Materials npm output contains only public runtime/Manifest artifacts; UI/Editor stay private. Template dependencies use exact registry versions, never production vendor archives.

- MaterialLayout declares serializable default occupancy independently of acceptsChildren. getMaterialDisplay resolves only static property values; never evaluate expressions for design layout. Instance layout properties remain validated material props and use the existing version-checked operation pipeline.
