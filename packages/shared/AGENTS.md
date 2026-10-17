# Shared harness

Applies to `packages/shared/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- `src/protocol/api.ts`: HTTP shapes and domain records.
- `src/protocol/project-manifest.ts`: executable project/page manifest contract shared by trusted hosts.
- `src/protocol/project-stack.ts`: versioned stack references and strict current-format resolution. Concrete catalogs and executable module loaders do not belong here. materialSet is required; missing or unsupported values fail without fallback or migration.
- `src/protocol/flow-node.ts`: pure-data logical node Manifest catalog, canonical property schemas, derived node parameter types, result descriptions and connection constraints. Editor owns forms/graph layout; Runtime derives its implementation keys and parameters here and validates Engine data before execution. Adding this catalog does not enable Server validation or Agent tools automatically.
- `src/protocol/schema.ts`: page Schema, IDs and typed operation variants.
- `src/protocol/agent.ts`: unified Page Agent Run, terminal outcome, structured clarification and typed SSE payload contracts; `agent-validation.ts` validates both event envelopes and their type-specific payloads.
- `src/protocol/validation.ts`: structural and semantic validators.
- `src/desktop-api.ts`: workbench bridge contracts; `src/page-window.ts`: iframe preview snapshot and diagnostic contracts.

- `src/protocol/material-manifest.ts` owns material Manifest types and format version; concrete material catalogs and conversion helpers stay in Materials. This entry is a format contract, not a new runtime validator.

## Contract rules

- This is platform-neutral contract code, published as an independent ESM package, not a runtime service or miscellaneous utility bucket. No Node.js, Electron, React, Fastify, browser globals or other workspace-package dependencies.
- Keep external behavior deterministic and side-effect-free: no filesystem/network calls, environment reads, credentials or process startup.
- Define runtime schemas alongside transport shapes and derive TypeScript types where practical. A cast cannot validate untrusted input; receiving boundaries must actually validate it.
- `getElementLabel` in `protocol/schema.ts` resolves editor labels to a nonblank `props.alias`, otherwise the supplied localized material title (falling back to `type`); `getAgentElementLabel` uses the alias or `elementId（localized material title）` for Agent references. It never changes the stable identity used by mutations or clarification selection.
- Preserve stable IDs, schemaVersion, operation discrimination, Working-version concurrency and error/result semantics. Breaking persisted formats need explicit version/migration strategy, not silently relaxed validation.
- Keep the HTTP result envelope in `src/protocol/api.ts` synchronized with every producer and consumer; `data` is always present, and failures never place error metadata inside it.
- Separate shape validation from semantic checks such as root existence, layout references and cycles. Never weaken validators to accept invalid fixtures/model responses.
- Review all App/Server/Desktop producers and consumers when changing exports. Keep preview contracts read-only and separate from workbench APIs.
- Consumers import only `@origamix/shared`. `src/index.ts` explicitly lists public value and type exports; internal modules import each other directly, never through the root barrel. `build` emits the single ESM entry and declarations to `dist`; keep workspace and published root exports synchronized and independently consumable. Relative source imports include `.ts` so Node 24 tooling can load the workspace root directly; the base TypeScript config rewrites extensions when emitting. Ajv instances and individual compiled validators initialize on first use and are cached; importing the root must not compile validators.

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
