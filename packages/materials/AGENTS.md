# Materials harness

Applies to `packages/materials/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- `antd/runtime.ts`: Ant Design runtime registry; `antd/index.ts` retains compatibility for existing generated pages.
- `antd/editor.ts`: editor groups, Manifest catalog and property-editor registrations; `antd/group.ts` retains compatibility.
- `antd/*/manifest.ts`: material-owned, serializable definitions; `antd/manifest.ts` is the pure-data compatibility and aggregation entry point.
- `antd/*/definition.ts`: the single serializable source for editor metadata and Manifest data when a material has migrated to `OrigamixMaterial`.
- `src/material-definition.ts`: pure-data definition/Manifest converters; editor-specific conversion remains in `src/origamix-material.ts`. Keep React rendering helpers out of Server-facing Manifest imports.
- `antd/manifest-definition.ts`: shared declaration helpers for colocated manifests; it has no React or editor imports.
- `antd/material-set.ts`: installed material-set identity shared by Manifest and runtime; runtime exports it so lazy consumers can check the installed version without loading editor metadata.
- `antd/*/index.tsx`: thin Tangramino-compatible component adapters.
- `antd/*/material-config.ts`: stable material metadata, defaults, context and editor controls.
- Package-local editor controls, contracts and helpers should stay in this package when they are added; they must not reach into App source.

- Build-only Shared imports are inlined in both JavaScript and declarations. The DTS build resolves the declared Shared export dynamically because tsup’s legacy resolver does not handle subpath export maps; do not replace it with a hardcoded cross-package source path. Verify packed runtime entries remain standalone.
- Manifest format types now live in `@origamix/shared/protocol/material-manifest`; `src/material-manifest.ts` re-exports them for compatibility and retains conversion helpers. Concrete catalogs remain material-owned. Target entry isolation and migration scope are recorded in [architecture](../architecture.md).

## Material rules

- This package owns page/runtime materials, not Origamix workbench UI. Ant Design is the only supported material family today; add another family behind a separate entry point and registry rather than mixing its components into `antd/`.
- Keep the package consumable through declared `@origamix/materials` exports. Do not import App, Desktop, Server, Node.js or Electron source, and do not use aliases that resolve outside this package.
- Workspace type exports resolve to package source so downstream typechecks do not depend on prebuilt `dist`; runtime imports and `publishConfig.exports` resolve to compiled files. Keep both export maps synchronized.
- A registry key, manifest `type` and persisted Schema type form a compatibility boundary. Renames and removals require a migration plan and coordinated Shared/Server/App/Template changes.
- Common `alias` properties and `init` lifecycle events are composed by `withCommonMaterialManifest`; `toEditorMaterial` derives the matching optional alias field and events. Both editor and runtime registries strip `alias` before rendering, without changing the retained Schema. Keep this contract centralized rather than adding App-only plugins.
- Runtime adapters should forward supported props and Tangramino context deliberately. Do not leak editor-only props to DOM elements, mutate Schema or add persistence/network side effects.
- Runtime components use the package-local minimal runtime props contract; do not import editor contracts solely for injected render props. Editor metadata and controls may continue to depend on the editor package through editor-facing entries.
- Keep manifests serializable except for documented component/render references used by the editor. Defaults must be deterministic and safe to render without project data.
- Structured attribute editors use `uiType: 'json'` with an editor-only `validateValue` guard. Keep that callable outside Manifest entries; Editor owns its input UI and App passes accepted data through the existing Working pipeline. Do not enable the deferred option editors as a side effect.
- Prefer `OrigamixMaterial` definitions for simple materials: derive their Manifest with `toMaterialManifest` and attach the runtime component with `toEditorMaterial`. Keep component references and custom render controls outside definitions so Server-facing imports remain pure data.
- Declare every imported library directly. React and Ant Design remain peer dependencies for consumers; local dependency entries support workspace development and verification.
- HeroUI and Tangramino base-editor are optional editor-only peers. Runtime and Manifest JavaScript/declarations must not import them. Editing hosts install those peers explicitly; standalone template smoke rejects installed editor engines.
- Use Ant Design controls for material implementations and `lucide-react` for any additional icons. Do not hand-write SVG icons.
- New or changed visual materials need accessible labels/states where applicable and interaction checks in both light and dark themes.

## Required build workflow

- After changing material implementation, defaults, editor configuration, Manifest definitions or exports, manually run `pnpm --filter @origamix/materials build` from the repository root before integration verification or handoff. Documentation-only changes do not require a build. Do not assume frontend hot reload updates compiled package exports or the running backend.
- When a change affects the persisted Schema contract or Server validation (properties, types, defaults, hierarchy, events or Manifest exports), then run `pnpm --filter @origamix/server build:assemble`. Server bundles the compiled pure-data Manifest; do not bypass package exports with source aliases or relax validation to mask stale artifacts.
- For Desktop verification, also assemble the new backend into the host with `pnpm --filter @origamix/desktop build:assemble`. Ensure the running host/backend has reloaded the new artifacts before checking the API. Building files alone does not update an already running process; preserve uncommitted editor drafts before any restart and never replay ambiguous mutations automatically.
- Report which builds and runtime reloads were completed. If the backend was not reloaded, explicitly state that live API verification still uses the previous rules.

## Verification

From the repository root:

```sh
pnpm --filter @origamix/materials lint
pnpm --filter @origamix/materials typecheck
pnpm --filter @origamix/materials test
pnpm --filter @origamix/materials build
```

- Keep registry/manifest tests focused on serializability and agreement between public catalogs. Prefer extending an existing invariant when types, grouping, defaults or exports change. Do not add component tests; verify material rendering and interaction in the consuming editor/runtime.
- Run the root gates after source or public-contract changes. A package-only typecheck does not verify App, preview and generated-project integration.
- UI changes require rendering representative materials in the consuming editor/runtime; report if graphical verification is unavailable.
