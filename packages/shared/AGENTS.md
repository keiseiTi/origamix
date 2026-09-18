# Shared harness

Applies to `packages/shared/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- `src/protocol/api.ts`: HTTP shapes and domain records.
- `src/protocol/project-manifest.ts`: executable project/page manifest contract shared by trusted hosts.
- `src/protocol/schema.ts`: page Schema, IDs and typed operation variants.
- `src/protocol/validation.ts`: structural and semantic validators.
- `src/desktop-api.ts`: workbench bridge contracts; `src/page-window.ts`: iframe preview snapshot and diagnostic contracts.

## Contract rules

- This is platform-neutral contract code, published as an independent ESM package, not a runtime service or miscellaneous utility bucket. No Node.js, Electron, React, Fastify, browser globals or other workspace-package dependencies.
- Keep external behavior deterministic and side-effect-free: no filesystem/network calls, environment reads, credentials or process startup.
- Define runtime schemas alongside transport shapes and derive TypeScript types where practical. A cast cannot validate untrusted input; receiving boundaries must actually validate it.
- Preserve stable IDs, schemaVersion, operation discrimination, Working-version concurrency and error/result semantics. Breaking persisted formats need explicit version/migration strategy, not silently relaxed validation.
- Keep the HTTP result envelope in `src/protocol/api.ts` synchronized with every producer and consumer; `data` is always present, and failures never place error metadata inside it.
- Separate shape validation from semantic checks such as root existence, layout references and cycles. Never weaken validators to accept invalid fixtures/model responses.
- Review all App/Server/Desktop producers and consumers when changing exports. Keep preview contracts read-only and separate from workbench APIs.
- Consumers import declared `@origamix/shared/...` exports. `build` emits ESM and declarations to `dist`; keep every public subpath explicitly listed in both export maps and the package contents independently consumable.

## Verification

From the repository root:

```sh
pnpm --filter @origamix/shared lint
pnpm --filter @origamix/shared typecheck
pnpm --filter @origamix/shared test
pnpm --filter @origamix/shared build
```

- Add positive/negative cases under `test/protocol/` for changed contracts. Include malformed IDs, missing fields, invalid references and incompatible changes where relevant.
- Run all root gates for downstream compilation and behavior; Shared passing alone is insufficient for a public-contract change.
- Root ESLint restrictions cover some platform imports, not the entire dependency graph. Review imports/manifests explicitly; do not describe architectural isolation as fully lint-enforced.
