# `@origamix/materials`

Origamix's source-only page material library. It currently provides Ant Design adapters and editor manifests for Tangramino.

## Public entries

```ts
import materialComponents from '@origamix/materials/antd';
import materialGroups from '@origamix/materials/antd/group';
```

- `materialComponents` maps persisted material type names to runtime React components.
- `materialGroups` supplies the editor palette and each material's defaults, context contract and property-panel configuration.

The package is private and compiled by its workspace consumers. It does not produce a standalone `dist` directory yet.

The imported package-local Manifest interfaces and editor helpers are still being supplied. Until those land, the new typecheck/build commands intentionally expose the missing modules instead of masking an incomplete package.

## Development

```sh
pnpm --filter @origamix/materials lint
pnpm --filter @origamix/materials typecheck
pnpm --filter @origamix/materials test
pnpm --filter @origamix/materials build
```

Ant Design is the only supported family. Add a new family as a separate directory and explicit package export, while keeping persisted type names stable. See [AGENTS.md](AGENTS.md) for package boundaries and verification expectations.
