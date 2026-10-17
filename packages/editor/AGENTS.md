# Editor harness

Applies to `packages/editor/`. Read the [root guide](../../AGENTS.md) first.

## Ownership

- `src/visual/` owns the shared EditorProvider, canvas, panels, selection, history and Agent clarification marker presentation. App supplies marker data and callbacks; Agent lifecycle remains in App.
- `src/flow/` owns LogicFlow, React nodes, event tree, node forms and graph translation. Both views share the same engine and edit session. Flow node contracts come from Shared; execution belongs to Runtime. Custom JS remains inert configuration.
- `src/core/` owns snapshot-to-operation translation, engine adapters and injected theme/material context. `src/components/` exports CodeEditor and JsonAttributeField; primitive controls belong to UI.
- `src/contracts.ts` and `src/extensions.ts` own public editing/extension contracts. `src/styles.css` registers Editor-owned Tailwind sources. Visual/flow entries load their LogicFlow styles; the host composes Tailwind and UI foundations.

## Boundaries

- Never import App, Materials, Runtime, Server, Desktop, Node.js or Electron. App provides the concrete catalog and material groups; FlowEditor reads the injected catalog rather than Antd imports.
- No HTTP, Working recovery, Revision, Apply, App Store or host credential ownership here. The visual entry receives a loaded schema, stable sessionKey, registration, explicit theme and change/flush callbacks.
- The schema prop is the initial projection for one sessionKey, not a second authoritative store. Ordinary saves do not replace it or reset history; an explicit new sessionKey remounts the engine. App retains in-flight drafts and advances the committed Working version only after Server success.
- Each flush translates against the last acknowledged Working snapshot through `createEditorTransaction`. Typed operations are preferred; the internal candidate fallback is only for operation protocol gaps. Prop edits and Flow edits use the same host queue.
- Preserve scoped async results, failed drafts and flush rejection before page/mode/preview transitions. Readonly view changes must not reach the host; never add a separate save path to a panel or flow node.
- CodeEditor receives theme explicitly or from the Editor context. App configures Monaco workers in its Vite bootstrap; this package must not import Vite worker queries or App preferences.
- Materials owns its Tangramino/HeroUI panel configuration types behind its editor entry. `JsonAttributeConfig` is the editor-owned structured-field shape; no imports back into Materials are allowed. Custom property editor activation is deferred until requested; existing JSON attribute fields remain available.
- Keep extensions limited to selected-element props. Do not expose raw engine, HTTP, filesystem, App Store or a generic host SDK.

## Verification

Run `pnpm --filter @origamix/editor lint`, `typecheck`, `test`, `build` and all four root gates. Existing snapshot-operation and graph safety tests live in `test/core/` and `test/flow/`; App owns persistence-session failures and stale-response checks. Do not add presentation tests for this migration.

UI verification must exercise actual visual/flow switching, event selection, history, code-editor workers, preview and both themes. Successful HTTP is not rendering evidence.
