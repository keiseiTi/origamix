# Runtime harness

Applies to `packages/runtime/`. Read the [root guide](../../AGENTS.md) first.

- `src/index.ts` is the sole public entry, exporting OrigamixPage, DesignRenderer and their contracts. `src/react.tsx` owns run-mode sessions; `src/design.tsx` owns declarative design rendering; `src/renderer.tsx` shares stable material rendering and layout traversal. `src/core/` owns local element subscriptions, layout parsing and flow dispatch. Workspace and published exports both use compiled dist; build Shared before Runtime, and Runtime before consumers.
- This adapter is the shared rendering core for generated projects and App preview. Preview-specific refresh, diagnostics and last-known-good presentation stay in App and must not duplicate engine/material setup.
- Callers use React's `key` on `OrigamixPage` to start a fresh runtime session.
- Keep engine creation, unknown-material detection and render error capture inside the Runtime boundary. Expose framework-neutral diagnostic outcomes and optional presentation hooks; App owns styled recovery UI and diagnostic transport.
- Report event flow failures through `OrigamixPage.onFlowError` and sanitized diagnostics. The caller owns their presentation.
- Runtime renders a supplied Schema with an explicit material registry. It must not import App, Server, Desktop, persistence, routing or credentials.
- `src/logic-nodes.ts` owns declarative event actions used by the React adapter. It resolves Shared HyperValue envelopes through `src/execute.ts`, executes HTTP requests without host credentials, and supports conditional, method, property, visibility, variable and modal/drawer actions. Expressions and functions, including customJS, execute only in the page Runtime. This is JavaScript execution, not a security sandbox; never invoke it in Editor, Main or Server. Object/array global defaults are JSON data; parse serialized JSON without executing initializers.
- Shared's `src/flow/flow-node-manifest.ts` owns node identities and parameter schemas. Derive handler keys and parameter types from that contract and validate Engine data before dispatch. `start` captures each invocation payload before its first asynchronous action; `customJS` executes a FunctionValue through the same evaluator. Shared is a declared build dependency inlined into the runtime artifact; packed JavaScript/declarations must remain independently consumable without a workspace Shared install.
- Keep all public APIs at the root entry; do not add framework or mode subpaths. Runtime does not bundle a material family.
- Verify with `pnpm --filter @origamix/runtime lint`, `typecheck`, `test` and `build`; generated-project changes also require the Server template smoke.

- `src/material-state.ts` owns Engine-scoped business projections, capability checks and per-invocation event snapshots. User input must not call a renderer path that rebuilds all components; preserve focus and local composition. Programmatic property writes still render the changed element and synchronize bound Form fields. These projections never update source Schema or Working.

- DesignRenderer never creates an execution engine or binds business events, evaluates code, initializes runtime variables or provides runtime state/method callbacks. Editor owns selection, dragging, history and Schema mutations. Runtime cannot import Editor or Materials. Runtime sessions abort requests and ignore late writes on disposal; async event invocations own separate payload/result context.

- Run and design renderers accept Schema with a compatible structure and semantics regardless of the declared version. Runtime never migrates project data.

- MaterialView owns the same layout frame in design/run modes, reading serializable origamixLayout metadata attached to registry components. It consumes validated layout-prefixed instance props before forwarding business props. Root frames include scoped baseline sizing CSS so generated projects need no editor stylesheet. Design renderMaterial accepts frame attributes/ref separately from material props.

- Design renderMaterial may place its shared frame inside overlay content through framePlacement and om_renderDesignFrame. These design-only callbacks provide layout/selection geometry without creating an execution engine or mutating Schema.

- Runtime material metadata supplies role and valueProp. Portal actions and Form writes use these capabilities, never concrete Ant Design names; initial state and event projection remain component-owned. Runtime snapshots the first event callback argument as serializable event.payload, without per-material event converters. Components publish initial state and register actions before lifecycle init runs.

- Common layoutPosition/layoutX/layoutY/layoutZIndex are consumed on the same MaterialView frame in design/run modes. Container owns its relative positioning context. Page roles are project metadata and do not alter public layout composition or navigation automatically.

- MaterialView consumes validated layoutShrink alongside layoutGrow on the shared frame. Do not patch material DOM ancestors to force sizing.

- Template owns the generated application shell. PageNavigationProvider injects only a current-project page-ID allowlist and router callback; it has no shared state or authentication behavior.
