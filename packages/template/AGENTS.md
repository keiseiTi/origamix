# Template harness

Applies to `packages/template/` in this workspace. Read the [root guide](../../AGENTS.md) first. This guide is for scaffold maintenance, not automatically for generated user projects.

## Ownership and entry points

- `src/main.tsx`, `src/router.ts`, and the manifest-configured page directory (default `src/pages/`): portable React/Tangramino scaffold.
- `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`: standalone tools and build configuration.
- The template README is also the generated-project usage documentation; ProjectSource only customizes its heading and project code.
- Copying is owned by `../server/template.ts`; coverage starts in `../server/test/template.test.ts` and `../server/test/test-template.mjs`.
- Runtime/Materials package preparation and dependency rewriting use Server template-artifact tooling from template smoke and Desktop resource assembly; do not reintroduce separate packing recipes.

## Portability contract

- Generated projects must install, typecheck and build outside the monorepo. Declare runtime/dev dependencies locally; no `workspace:*`, cross-package source imports, root-only tsconfig inheritance or absolute developer paths.
- Do not import Electron, the desktop bridge, Origamix's local backend or privileged credentials. Generated runtime is independent of the editor.
- Generated page code is a stable shell: it loads the page's managed `schema.json`, registers the declared `@origamix/materials/*` package and renders through `@origamix/runtime`. Origamix applies Schema only; it must not regenerate or overwrite the shell during ordinary editing.
- Keep Tangramino page data compatible with Shared Schema without a runtime dependency on `@origamix/shared`. Coordinate format changes with Server project/page generation and the Apply-to-Project pipeline.
- Use strict TypeScript and Tailwind. Follow root HeroUI/Lucide requirements when adding controls/icons and declare imported packages directly, including stylesheet entry packages such as `@heroui/styles`. Do not add packages for unused future plans.
- Changed pages support light/dark themes and accessible states. Do not copy workbench navigation, editor chrome or mock persistence into generated applications.
- Keep source-only content: no installed dependencies, private files, caches, app databases, compiled output or user projects.
- Generated `.origamix/` content is local editing state, not runtime input; keep it ignored by default and document that deployed pages read `src/<pageDirectory>/*/schema.json`, with `pageDirectory` declared by the project manifest.
- The Server copier excludes this `AGENTS.md` via its root allowlist. Shipping guidance into generated projects is a separate product change requiring standalone instructions without monorepo-only paths/commands.
- New runtime/build assets require reviewing the copy allowlist and packaged resources, then testing a project created by ProjectService after a real Schema apply. Copying and building the untouched template is not portability evidence.

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
