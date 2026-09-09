# Materials harness

Applies to `packages/materials/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- `antd/index.ts`: Ant Design runtime component registry.
- `antd/group.ts`: editor-facing material groups and manifests.
- `antd/*/manifest.ts`: material-owned, serializable definitions; `antd/manifest.ts` is the pure-data compatibility and aggregation entry point.
- `antd/manifest-definition.ts`: shared declaration helpers for colocated manifests; it has no React or editor imports.
- `antd/*/index.tsx`: thin Tangramino-compatible component adapters.
- `antd/*/material-config.ts`: stable material metadata, defaults, context and editor controls.
- Package-local editor controls, contracts and helpers should stay in this package when they are added; they must not reach into App source.

## Material rules

- This package owns page/runtime materials, not Origamix workbench UI. Ant Design is the only supported material family today; add another family behind a separate entry point and registry rather than mixing its components into `antd/`.
- Keep the package consumable through declared `@origamix/materials` exports. Do not import App, Desktop, Server, Node.js or Electron source, and do not use aliases that resolve outside this package.
- A registry key, manifest `type` and persisted Schema type form a compatibility boundary. Renames and removals require a migration plan and coordinated Shared/Server/App/Template changes.
- Runtime adapters should forward supported props and Tangramino context deliberately. Do not leak editor-only props to DOM elements, mutate Schema or add persistence/network side effects.
- Keep manifests serializable except for documented component/render references used by the editor. Defaults must be deterministic and safe to render without project data.
- Declare every imported library directly. React and Ant Design remain peer dependencies for consumers; local dependency entries support workspace development and verification.
- Use Ant Design controls for material implementations and `lucide-react` for any additional icons. Do not hand-write SVG icons.
- New or changed visual materials need accessible labels/states where applicable and interaction checks in both light and dark themes.

## Verification

From the repository root:

```sh
pnpm --filter @origamix/materials lint
pnpm --filter @origamix/materials typecheck
pnpm --filter @origamix/materials test
pnpm --filter @origamix/materials build
```

- Add registry/manifest tests when the package-local contracts are available and when changing types, grouping, defaults or public exports. Add component tests for non-trivial prop translation and state behavior.
- Run the root gates after source or public-contract changes. A package-only typecheck does not verify App, preview and generated-project integration.
- UI changes require rendering representative materials in the consuming editor/runtime; report if graphical verification is unavailable.
