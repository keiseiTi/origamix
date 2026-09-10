# Runtime harness

Applies to `packages/runtime/`. Read the [root guide](../../AGENTS.md) first.

- `react.tsx` owns the thin React adapter around Tangramino Engine and ReactView.
- This adapter is the shared rendering core for generated projects and App preview. Preview-specific refresh, diagnostics and last-known-good presentation stay in App and must not duplicate engine/material setup.
- Runtime renders a supplied Schema with an explicit material registry. It must not import App, Server, Desktop, persistence, routing or credentials.
- Keep React and framework integrations behind explicit package exports. Runtime does not bundle a material family.
- Verify with `pnpm --filter @origamix/runtime lint`, `typecheck`, `test` and `build`; generated-project changes also require the Server template smoke.
