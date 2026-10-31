# Materials harness

Applies to `packages/materials/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- `antd/runtime.ts`: Ant Design runtime registry.
- `src/index.ts`: public root explicitly exporting every public type and helper from `src/`, including material contracts, editor assembly, Manifest helpers, runtime props, value types and class-name utilities; replaces the former `/material` subpath; never aggregate concrete Ant Design materials here.
- `antd/editor.ts`: public `/antd/editor` entry for editor groups, Manifest catalog and property-editor registrations. Runtime and Manifest retain their separate public subpaths; Server must never load the root or editor entry.
- `antd/*/material-config.ts`: the sole material definition, using `defineMaterial`; `antd/manifest.ts` aggregates generated pure-data manifests.
- Define metadata, capabilities, defaults and panels together. Infer simple property schemas from controls; custom/JSON fields and exceptional constraints supply `schema`. `hidden` fields retain protocol-only properties without displaying controls. Never duplicate field rules in a hand-maintained Manifest.
- `src/origamix-material.ts`: the single `defineMaterial({ type, title, ..., Component, editorConfig })` assembly path. `Material` is its output type, not a hand-written parallel definition. Keep React rendering helpers out of Server-facing Manifest imports.
- `src/material-definition.ts` derives Manifest data and injects `antd/material-set.ts` version/common metadata. `scripts/generate-manifest.ts` loads configurations in Node and atomically writes version-controlled `antd/generated/manifests.ts` before builds. Commit generated changes with their configurations, but never edit them manually; configuration imports must be Node-loadable, with browser-only components loaded lazily.
- `antd/manifest-defaults.ts` restores shared properties, lifecycle and version for generated material-specific data without editor/React imports. Consumers import the stable `antd/manifest.ts` facade, never `generated/` directly.
- `pnpm manifest:check` verifies generation without modifying files; root `pnpm check` and the staged TypeScript gate run it before Materials can regenerate output.
- `antd/material-set.ts`: installed material-set identity shared by Manifest and runtime; runtime exports it so lazy consumers can check the installed version without loading editor metadata.
- `antd/*/index.tsx`: thin Origamix material component adapters.
- `pnpm manifest:watch` regenerates with a fresh subprocess/module graph after changes in `antd`, `src`, `components`, `utils` or `scripts` and package/TypeScript configuration. Source-only polling avoids native watcher limits; never scan `node_modules`, `dist` or generated output. Root `pnpm dev` starts one long-lived instance of this watcher after initial library preparation and stops it with the Desktop supervisor. Existing source watchers still own ordered rebuilds; generated output must not trigger another rebuild. Both web/Desktop library preparation explicitly generates manifests before invoking tsdown.
- Package-local editor controls, contracts and helpers should stay in this package when they are added; they must not reach into App source.

- `tsconfig.json` retains `@` → `src/index.ts` and `@/*` → `src/*`; tsdown resolves these aliases for JavaScript and declarations. Built artifacts must not retain private aliases.
- Build-only Shared imports are inlined in JavaScript and declarations. `tsdown.config.ts` explicitly bundles Shared/Runtime declaration dependencies while leaving their third-party dependencies external. Verify packed runtime entries remain standalone.
- Manifest format types live in `@origamix/shared`; import them directly. `src/material-manifest.ts` contains only material-owned conversion helpers. No historical exports or data-shape conversions are provided.

## Material rules

- Built-in materials, material sets and the Materials package share the Origamix release version; `material-set.ts` uses Shared ORIGAMIX_VERSION. Legacy page conversion belongs exclusively to the Server Schema migration chain; materials must not retain legacy property branches.

- This package owns page/runtime materials, not Origamix workbench UI. Ant Design is the only supported material family today; add another family behind a separate entry point and registry rather than mixing its components into `antd/`.
- Keep the package consumable through declared `@origamix/materials` exports. Do not import App, Desktop, Server, Node.js or Electron source, and do not use aliases that resolve outside this package.
- Workspace and published exports both resolve JavaScript and types to `dist`; do not expose source aliases to consumers. Root `pnpm typecheck` builds Materials first. Before isolated App/Server typechecks, build Materials explicitly. Keep both export maps synchronized.
- Keep registry keys, manifest `type` and Schema types consistent. Renames and removals require coordinated Shared/Server/App/Template changes; do not add historical aliases or format conversions.
- Common `alias` properties and `init` lifecycle events are composed by `withCommonMaterialManifest`; `defineMaterial` derives the matching optional alias field and events. The editor registry uses material components; the runtime entry binds them with the package-owned runtime-state adapter for capability metadata and Form fields; `alias` may pass through with other Schema props. Keep this contract centralized rather than adding App-only plugins.
- Runtime adapters should forward supported props and Origamix rendering context deliberately. Keep engine callbacks out of DOM props; do not mutate Schema or add persistence/network side effects.
- Runtime components use the package-local minimal runtime props contract; do not import editor contracts solely for injected render props. Editor metadata and controls may continue to depend on the editor package through editor-facing entries.
- Keep generated manifests strictly serializable; component/render references remain in editor configuration. Defaults must be deterministic and safe to render without project data.
- Structured attribute editors use `uiType: 'json'` with an editor-only `validateValue` guard. Keep that callable outside Manifest entries; Editor owns its input UI and App passes accepted data through the existing Working pipeline. Table columns use `components/columns-editor.tsx` (summary table, immediate explicit deletion and a draft-backed configuration dialog); Checkbox/Radio/Select options use `components/collection-editor.tsx`. Both use editor-only `uiType: 'custom'` controls; their value/onChange contract and read-only elementProps/field-name metadata edit only the current field through the existing Working pipeline. Keep draft rows local until explicit update.
- Define every built-in material with `defineMaterial`; generate its Manifest from that definition. Keep component references and custom render controls outside manifests so Server-facing imports remain pure data. `defineMaterial.acceptsChildren` is the sole child-acceptance declaration. `layout` declares default occupancy; `defineMaterial` attaches it to components as `origamixLayout`, matching runtime registration. Editor refs/selection attach to the Runtime layout node, not the business component.
- Declare every imported library directly. React and Ant Design remain peer dependencies for consumers; local dependency entries support workspace development and verification.
- UI (`@origamix/ui`) is an optional editor-only peer; no external editor engine is required. RuntimeMaterialProps is imported as a type from @origamix/runtime and inlined in declarations. Attribute control props derive from UI components; numeric and color fields use Input props. Runtime and Manifest JavaScript/declarations must not import them. Editing hosts install those peers explicitly; standalone template smoke rejects installed editor engines.
- Use Ant Design controls for material implementations and `lucide-react` for any additional icons. Do not hand-write SVG icons.
- New or changed visual materials need accessible labels/states where applicable and interaction checks in both light and dark themes.

## Required build workflow

- After changing material implementation, defaults, editor configuration, definition extraction or exports, manually run `pnpm --filter @origamix/materials build` from the repository root before integration verification or handoff. On a clean checkout, prepare Shared and Runtime first, or use `pnpm --filter @origamix/materials... build` to build the dependency chain. Documentation-only changes do not require a build. Build/typecheck/test generate manifests first; generation failures stop the command. Do not assume frontend hot reload updates compiled package exports or the running backend.
- When a change affects the persisted Schema contract or Server validation (properties, types, defaults, hierarchy, events or Manifest exports), then run `pnpm --filter @origamix/server build`. Server bundles the compiled pure-data Manifest; do not bypass package exports with source aliases or relax validation to mask stale artifacts.
- For Desktop verification, also assemble the new backend into the host with `pnpm --filter @origamix/desktop build`. Ensure the running host/backend has reloaded the new artifacts before checking the API. Outside the Desktop development supervisor, building files alone does not update an already running process. `pnpm dev` builds affected dependencies in order, stages matching artifacts and automatically restarts the host after successful preparation. The terminal p command pauses/resumes this development restart. Preserve drafts before restarting and never replay ambiguous mutations.
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
- `antd/runtime-provider.tsx` exports the runtime-only Ant Design theme boundary through `/antd/runtime`; preview hosts pass their theme explicitly without importing Ant Design into the generic Runtime adapter.

- `context.variables` is the read whitelist, `context.writable` the runtime-write whitelist, `context.actions` callable methods, and `context.events` events. Keep them independent of propsSchema. Built-in runtime metadata is attached only in `antd/runtime.ts`; never add editor imports there. `basicPage` is registered separately as a hidden root material, not a draggable palette entry; FloatButton stays unregistered.
- `antd/runtime-state.tsx` owns canonical input values, event payload projection and Form field binding. User changes publish through om_setRuntimeState before invoking events. Form methods/programmatic field writes must update both field and form projections. Shared/Server/Runtime enforce capabilities; do not fix a failed capability check by adding all props to variables/writable.

- Keep Materials as one package. Separate runtime, editor and pure-data Manifest entry points; never import editor controls or UI from runtime/Manifest. UI remains private and is used only by the internal editor host. Do not introduce a separate materials-internal package. Runtime-only consumers must install without UI or editor engines.

- Build and publication ownership follows [package artifact contract](../../site/docs/architecture/development.md). Materials npm output contains only public runtime/Manifest artifacts; UI/Editor stay private. Template dependencies use exact registry versions, never production vendor archives.

- Modal/Drawer declare editorConfig.presentation as overlay. Design visibility and close callbacks belong to Editor, independently of persisted open props; runtime native close behavior remains in the material. They accept children directly and add no default container or flow.
