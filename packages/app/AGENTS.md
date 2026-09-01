# App harness

Applies to `packages/app/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- `src/app.tsx`, `src/components/`: React workbench and interactions.
- `src/services/request.ts` and sibling services: typed HTTP requests and errors.
- `src/store/workspace-store.ts`, `src/store/view-session.ts`: workspace projections and editing sessions.
- `src/components/workspace/editor-session.tsx`, `src/components/workspace/page-window.tsx`: editing and preview consumers.
- `dev-server.ts`, `vite.config.ts`, `scripts/`: Node-side Web development tooling, not Renderer code.

## Runtime boundaries

- Nothing under `src/` may import Node.js, Electron, Server or Desktop implementations. Use the typed optional desktop bridge and service-layer business requests.
- The Node development host may import `@origamix/server/runtime`. Never import host modules into browser source or expose tokens via `VITE_*`, Vite `define`, HTML or localStorage.
- Web mode is local development, not remote hosting. Preserve same-origin proxy checks and host-owned authentication. Unsupported native capabilities need clear disabled/error states, not fake success.
- Zustand is a projection. Schema mutation produces a typed ChangeSet through Server; update committed state only after success. Never persist authoritative Schema in a component, store or browser storage.
- Associate asynchronous work with page identity and revision; stale results must not overwrite another page. Preserve pending edits on failure.
- Preview uses the read-only preview bridge, never a fallback that requests desktop credentials. Rendering errors must remain visible without corrupting the editing session.

## Interaction contract

- Use HeroUI foundations, Tailwind and Lucide under root rules; consult installed APIs and existing usage rather than assuming another major version.
- Conversation/editor share one page/session. Editor fills the work area; header controls open overlay navigation/AI without resizing the canvas.
- Flush pending edits before page/mode switches and preview. Block transitions on save failure; restore per-page selection/viewport and safely clear invalid selections after Schema changes.
- Include keyboard operation, overlay focus restoration, Esc dismissal, loading/empty/error states and save feedback. Keep the fixed composer and overlays usable at narrow widths.
- Verify affected surfaces in light and dark themes, including preview and disabled/error states. Avoid hard-coded light-only colors.
- These are acceptance constraints for relevant changes, not claims that all planned editor/Agent features exist. Do not add drag/drop, flow editing or AI implementation unless requested.

## Verification

From the repository root:

```sh
pnpm --filter @origamix/app lint
pnpm --filter @origamix/app typecheck
pnpm --filter @origamix/app test
pnpm --filter @origamix/app build
```

- Extend `src/store/view-session.test.ts` and `src/services/request.test.ts` for affected transitions/transport; add focused tests beside new stateful logic.
- Web host/proxy changes: `pnpm --filter @origamix/app test:web`. Supervisor/rebuild changes: also `pnpm --filter @origamix/server test:dev`.
- Use `pnpm dev:web` for browser interaction checks. Directory pickers, settings and independent windows need `pnpm dev` and Desktop smoke checks, not only browser screenshots.
- Run root gates before handoff and report both-theme interaction evidence. Existing unit/smoke tests are not complete visual coverage.
