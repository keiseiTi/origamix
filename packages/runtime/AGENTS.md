# Runtime harness

Applies to `packages/runtime/`. Read the [root guide](../../AGENTS.md) first.

- `react.tsx` owns the React adapter around Tangramino Engine with stable per-element subscriptions.
- This adapter is the shared rendering core for generated projects and App preview. Preview-specific refresh, diagnostics and last-known-good presentation stay in App and must not duplicate engine/material setup.
- Keep engine creation, unknown-material detection and render error capture inside the Runtime boundary. Expose framework-neutral diagnostic outcomes and optional presentation hooks; App owns styled recovery UI and diagnostic transport.
- Runtime renders a supplied Schema with an explicit material registry. It must not import App, Server, Desktop, persistence, routing or credentials.
- `logic-nodes.ts` owns declarative event actions used by the React adapter. It resolves Shared HyperValue envelopes through `execute.ts`, executes HTTP requests without host credentials, and supports conditional, method, property, visibility, variable and modal/drawer actions. Expressions and functions, including customJS, execute only in the page Runtime. This is JavaScript execution, not a security sandbox; never invoke it in Editor, Main or Server. Initialize object/array global defaults with JSON parsing; never pass executable defaults to the Engine’s legacy initializer.
- Shared's `protocol/flow-node` owns node identities and parameter schemas. Derive handler keys and parameter types from that contract and validate Engine data before dispatch. `start` is engine-traversed and Runtime captures the invocation payload there; `customJS` executes a FunctionValue through the same evaluator. Shared is a declared build dependency inlined into the runtime artifact; packed JavaScript/declarations must remain independently consumable without a workspace Shared install.
- Keep React and framework integrations behind explicit package exports. Runtime does not bundle a material family.
- Verify with `pnpm --filter @origamix/runtime lint`, `typecheck`, `test` and `build`; generated-project changes also require the Server template smoke.

- `material-state.ts` owns Engine-scoped business projections, capability checks and per-invocation event snapshots. User input must not call a renderer path that rebuilds all components; preserve focus and local composition. Programmatic property writes still render the changed element and synchronize bound Form fields. These projections never update source Schema or Working.

- Runtime accepts only Schema tagged with Shared `ORIGAMIX_VERSION`; it never migrates project data. Older pages must be opened, saved and explicitly applied by Server before rendering with the new runtime.
