# Editor harness

Applies to `packages/editor/`. Read the [root guide](../../AGENTS.md) first.

- Stage 1 provides type-only `contracts` and `extensions` entries. Rendering remains in App until migration; do not claim the Editor component or shared controls are exported yet.
- Own visual/flow editing, selection, history and engine adaptation. App owns HTTP, project/page lifecycle, Working recovery, Revision, Apply and Agent orchestration.
- Never import App, Materials, Runtime, Server, Desktop, Node.js or Electron. Receive concrete material registrations from App. Import platform contracts through Shared exports.
- Keep property editors limited to the selected element's props. Capture scope and element identity when editing starts; reject stale/readonly commits before creating a transaction. A local commit is not proof of persistence.
- One transaction uses one base Working version; only Server success advances the authoritative projection. Candidate fallback is internal and only for operation protocol gaps. Failures retain drafts and block transitions through `flush` rejection.
- No generic host SDK, raw engine, filesystem, HTTP client or App Store in extensions. Add named host capabilities only when an implemented feature requires one.
- Future `visual`, `flow` and `components` exports belong here; shared primitive controls belong to UI. Do not add placeholder implementations.
- Run `pnpm --filter @origamix/editor lint`, `typecheck`, `build` and all four root gates. There are no runtime implementations requiring standalone tests in this stage.
