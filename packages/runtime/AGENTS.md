# Runtime harness

Applies to `packages/runtime/`. Read the [root guide](../../AGENTS.md) first.

- `react.tsx` owns the thin React adapter around Tangramino Engine and ReactView.
- This adapter is the shared rendering core for generated projects and App preview. Preview-specific refresh, diagnostics and last-known-good presentation stay in App and must not duplicate engine/material setup.
- Keep engine creation, unknown-material detection and render error capture inside the Runtime boundary. Expose framework-neutral diagnostic outcomes and optional presentation hooks; App owns styled recovery UI and diagnostic transport.
- Runtime renders a supplied Schema with an explicit material registry. It must not import App, Server, Desktop, persistence, routing or credentials.
- `logic-nodes.ts` owns declarative event actions used by the React adapter. It resolves explicit global/result data references, executes HTTP requests without host credentials, and supports conditional, method, property, visibility, variable and modal/drawer actions. Custom JS configurations remain inert. Initialize object/array global defaults with JSON parsing; never pass executable defaults to the Engine’s legacy initializer.
- Keep React and framework integrations behind explicit package exports. Runtime does not bundle a material family.
- Verify with `pnpm --filter @origamix/runtime lint`, `typecheck`, `test` and `build`; generated-project changes also require the Server template smoke.
