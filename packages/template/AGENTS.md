# Template harness

Applies to `packages/template/` in this workspace. Read the [root guide](../../AGENTS.md) first. This guide is for scaffold maintenance, not automatically for generated user projects.

## Ownership and entry points

- `src/main.tsx`, `src/router.ts`, `src/pages/`: portable React/Tangramino scaffold.
- `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`: standalone tools and build configuration.
- Copying is owned by `../server/template.ts`; coverage starts in `../server/template.test.ts` and `../server/scripts/smoke-template.mjs`.

## Portability contract

- Generated projects must install, typecheck and build outside the monorepo. Declare runtime/dev dependencies locally; no `workspace:*`, cross-package source imports, root-only tsconfig inheritance or absolute developer paths.
- Do not import Electron, the desktop bridge, Origamix's local backend or privileged credentials. Generated runtime is independent of the editor.
- Keep Tangramino page data compatible with Shared Schema without a runtime dependency on `@origamix/shared`. Coordinate format changes with Server project/page generation and validate generated output.
- Use strict TypeScript and Tailwind. Follow root HeroUI/Lucide requirements when adding controls/icons and declare dependencies locally; they are not currently installed here. Do not add packages for unused future plans.
- Changed pages support light/dark themes and accessible states. Do not copy workbench navigation, editor chrome or mock persistence into generated applications.
- Keep source-only content: no installed dependencies, private files, caches, app databases, compiled output or user projects.
- The Server copier excludes this `AGENTS.md` via its root allowlist. Shipping guidance into generated projects is a separate product change requiring standalone instructions without monorepo-only paths/commands.
- New runtime/build assets require reviewing the copy allowlist and packaged resources, then testing actual generated output. Building this package in place is not portability evidence.

## Verification

From the repository root:

```sh
pnpm --filter @origamix/template lint
pnpm --filter @origamix/template typecheck
pnpm --filter @origamix/template build
pnpm --filter @origamix/server test:template
```

- This package has no `test` script; root `pnpm test` does not establish template behavior coverage. Do not invent a test command. Use Server copy tests and standalone smoke checks; add suitable tests for new non-trivial logic.
- `test:template` installs dependencies into an isolated generated project and needs registry access or populated cache. Report missing prerequisites; never substitute a real user project.
- For UI changes run the template dev server and verify both themes. Run root gates for source changes; coordinate Desktop resource checks when scaffold packaging changes.
