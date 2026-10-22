# Editor harness

Applies to `packages/editor/`. Read the [root guide](../../AGENTS.md) first.

## Ownership

- `src/index.ts` exports the unified Editor; `src/editor.tsx` and `src/mods/` own the shared EditorProvider, canvas, panels, selection, history and generic target-selection markers. App owns Agent lifecycle and maps clarification state to the generic target-selection contract.
- `src/flow-editor/` is an internal Editor module that owns LogicFlow, React nodes, event tree, node forms and graph translation. Both views share the same engine and edit session. The module reads only its internal session contract; `src/mods/flow-editor-view.tsx` adapts the engine store, supplies schema/materials/catalog/onChange and loads the view dynamically with loading and retry states. Flow node contracts come from Shared; execution belongs to Runtime. HyperInput edits Shared HyperValue envelopes, including context bindings, expressions and functions. Editor never evaluates code; Runtime owns execution.
- `src/core/` owns snapshot-to-operation translation, engine adapters and injected theme/material context. `src/components/` exports CodeEditor and JsonAttributeField; primitive controls belong to UI.
- `src/interface.ts` and `src/extensions.ts` own public editing/extension contracts. `src/styles.css` registers Editor-owned Tailwind sources. The dynamically loaded FlowEditor loads its LogicFlow styles; the host composes Tailwind and UI foundations.

## Boundaries

- Components, transaction helpers and public types are exported only from `@origamix/editor`; `styles.css` is the sole separate entry. Keep internal imports relative and FlowEditor dynamically loaded. New public exports update `src/index.ts`, not package subpaths or additional build entries. Preserve CSS side effects.

- Never import App, Materials, Runtime, Server, Desktop, Node.js or Electron. App provides the concrete catalog and material groups; FlowEditor reads the injected catalog rather than Antd imports.
- Editor does not interpret AI Runs or clarification expiry. `targetSelection` receives host-owned candidates, highlight, disabled state and a selection callback. Read-only defaults are generic; App supplies business-specific messages.
- No HTTP, Working recovery, Revision, Apply, App Store or host credential ownership here. The unified Editor receives a loaded schema, stable sessionKey, registration, explicit theme and change/flush callbacks.
- The schema prop is the initial projection for one sessionKey, not a second authoritative store. Ordinary saves do not replace it or reset history; an explicit new sessionKey remounts the engine. App retains in-flight drafts and advances the committed Working version only after Server success.
- Each flush translates against the last acknowledged Working snapshot through `createEditorTransaction`. Typed operations are preferred; the internal candidate fallback is only for operation protocol gaps. Prop edits and Flow edits use the same host queue.
- `flow-editor/model.ts` keeps LogicFlow presentation dimensions in `extensions.flowGraph`, stripping `width`/`height` from executable node props so Runtime can validate them against Shared without allowing layout fields in the execution contract.
- Preserve scoped async results, failed drafts and flush rejection before page/mode/preview transitions. Readonly view changes must not reach the host; never add a separate save path to a panel or flow node.
- CodeEditor receives theme explicitly or from the Editor context. App configures Monaco workers in its Vite bootstrap; this package must not import Vite worker queries or App preferences.
- Materials owns its Tangramino/HeroUI panel configuration types behind its editor entry. `JsonAttributeConfig` is the editor-owned structured-field shape; no imports back into Materials are allowed. Custom attribute renderers receive the current field value, read-only selected-element props/field names and an onChange callback; key them by element/field/value so local edits cannot cross selection or external updates. Existing JSON attribute fields remain available.
- Keep extensions limited to selected-element props. Do not expose raw engine, HTTP, filesystem, App Store or a generic host SDK.

## Verification

Run `pnpm --filter @origamix/editor lint`, `typecheck`, `test`, `build` and all four root gates. Existing snapshot-operation and graph safety tests live in `test/core/` and `test/flow/`; App owns persistence-session failures and stale-response checks. Do not add presentation tests for this migration.

UI verification must exercise actual visual/flow switching, event selection, history, code-editor workers, preview and both themes. Successful HTTP is not rendering evidence.

- Flow forms follow the reference value kinds without a JSON kind or separate comparison operators. Requests edit headers/query/body through functions; conditions use expressions/functions. Coalesce LogicFlow model events until the mutation completes, then send the full executable flow and layout through the shared engine change callback with `immediate: true` in logic mode. Do not add panel-owned persistence.

- Flow read candidates come only from Manifest.context.variables; write candidates only from context.writable; method choices only from context.values with isMethod. Never merge propsSchema into these lists. Keep event.payload separate from durable element state. Root materials are injected separately and must not enter the draggable palette.
