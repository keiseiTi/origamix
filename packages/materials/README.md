# `@origamix/materials`

Origamix's bundled page material library. It provides Ant Design adapters and editor manifests for Tangramino.

## Public entries

```ts
import materialComponents from '@origamix/materials/antd';
import materialGroups from '@origamix/materials/antd/group';
```

- `materialComponents` maps persisted material type names to runtime React components.
- `materialGroups` supplies the editor palette and each material's defaults, context contract and property-panel configuration.

The package is private. `pnpm build` uses tsup to emit ESM bundles, declarations, and source maps into `dist`.

## Development

```sh
pnpm --filter @origamix/materials lint
pnpm --filter @origamix/materials typecheck
pnpm --filter @origamix/materials test
pnpm --filter @origamix/materials build
```

Ant Design is the only supported family. Add a new family as a separate directory and explicit package export, while keeping persisted type names stable. See [AGENTS.md](AGENTS.md) for package boundaries and verification expectations.
