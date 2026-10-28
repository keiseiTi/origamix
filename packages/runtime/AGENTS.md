# Runtime harness

Applies to `packages/runtime/`. Read the [root guide](../../AGENTS.md) first.

- `src/index.ts` is the sole public entry, exporting OrigamixPage, DesignRenderer and their contracts. `src/react.tsx` owns run-mode sessions; `src/design.tsx` owns declarative design rendering; `src/renderer.tsx` shares stable material rendering and layout traversal. `src/core/` owns local element subscriptions, layout parsing and flow dispatch. Workspace and published exports both use compiled dist; build Shared before Runtime, and Runtime before consumers.
- This adapter is the shared rendering core for generated projects and App preview. Preview-specific refresh, diagnostics and last-known-good presentation stay in App and must not duplicate engine/material setup.
- Keep engine creation, unknown-material detection and render error capture inside the Runtime boundary. Expose framework-neutral diagnostic outcomes and optional presentation hooks; App owns styled recovery UI and diagnostic transport.
- Runtime renders a supplied Schema with an explicit material registry. It must not import App, Server, Desktop, persistence, routing or credentials.
- `src/logic-nodes.ts` owns declarative event actions used by the React adapter. It resolves Shared HyperValue envelopes through `src/execute.ts`, executes HTTP requests without host credentials, and supports conditional, method, property, visibility, variable and modal/drawer actions. Expressions and functions, including customJS, execute only in the page Runtime. This is JavaScript execution, not a security sandbox; never invoke it in Editor, Main or Server. Object/array global defaults are JSON data; parse serialized JSON without executing initializers.
- Shared's `src/flow/flow-node-manifest.ts` owns node identities and parameter schemas. Derive handler keys and parameter types from that contract and validate Engine data before dispatch. `start` captures each invocation payload before its first asynchronous action; `customJS` executes a FunctionValue through the same evaluator. Shared is a declared build dependency inlined into the runtime artifact; packed JavaScript/declarations must remain independently consumable without a workspace Shared install.
- Keep all public APIs at the root entry; do not add framework or mode subpaths. Runtime does not bundle a material family.
- Verify with `pnpm --filter @origamix/runtime lint`, `typecheck`, `test` and `build`; generated-project changes also require the Server template smoke.

- `src/material-state.ts` owns Engine-scoped business projections, capability checks and per-invocation event snapshots. User input must not call a renderer path that rebuilds all components; preserve focus and local composition. Programmatic property writes still render the changed element and synchronize bound Form fields. These projections never update source Schema or Working.

- DesignRenderer never creates an execution engine or binds business events, evaluates code, initializes runtime variables or provides runtime state/method callbacks. Editor owns selection, dragging, history and Schema mutations. Runtime cannot import Editor or Materials. Runtime sessions abort requests and ignore late writes on disposal; async event invocations own separate payload/result context.

- Runtime accepts only Schema tagged with Shared `ORIGAMIX_VERSION`; it never migrates project data. Older pages must be opened, saved and explicitly applied by Server before rendering with the new runtime.

- Build and publication ownership follows [package artifact contract](../../site/docs/architecture/development.md). Materials npm output contains only public runtime/Manifest artifacts; UI/Editor stay private. Template dependencies use exact registry versions, never production vendor archives.
