# App harness

Applies to `packages/app/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- `src/app.tsx`, `src/components/`: React workbench and interactions.
- `src/services/request.ts` and sibling services: typed HTTP requests and errors.
- `src/components/workspace/state/`: window-scoped workspace projections and editing sessions.
- `src/components/agent-chat/`, `src/components/editor/`, `src/components/settings/`: feature-owned UI and state.
- `src/components/editor/`: editing UI and its save session; `src/runtime/` and `src/components/workspace/page-window.tsx`: reusable runtime rendering and the read-only preview surface.
- `dev-server.ts`, `vite.config.ts`, `scripts/`: Node-side Web development tooling, not Renderer code.

## Runtime boundaries

- Nothing under `src/` may import Node.js, Electron, Server or Desktop implementations. Use the typed optional desktop bridge and service-layer business requests.
- The Node development host may import `@origamix/server/runtime`. Never import host modules into browser source or expose tokens via `VITE_*`, Vite `define`, HTML or localStorage.
- The Renderer supports both browser and desktop hosts. Keep project/tab navigation and per-tab UI state in window `sessionStorage`; never send that state to Server. Desktop may integrate directory pickers, template installation, backend lifecycle and independent windows. Browser deployments use configured HTTP services and download/import flows instead of assuming Electron capabilities. Unsupported host capabilities need clear disabled/error states, not fake success.
- React state and Zustand are projections. Schema mutation produces a typed ChangeSet through Server; update committed Working Revision state only after success. Never persist authoritative Schema in a component, store or browser storage. Saved/previewed and applied-to-project are distinct states; Agent completion and undo must not auto-apply.
- Associate asynchronous work with page identity and revision; stale results must not overwrite another page. Preserve pending edits on failure.
- Resolve edit, preview, Agent, Apply and explicit project reload actions with `projectId` plus stable `pageId`; page names are display labels, not identity. A reload that discards Working Schema needs an explicit user confirmation, and late responses from another page must be ignored.
- Keep Workspace polling, save and Apply projections in the page-bound application-state hook keyed by projectId/pageId and, where relevant, revisionId. Ignore late responses for inactive pages instead of letting view components reconcile them ad hoc.
- Renderer transports cache backend authority only as a convenience. After a desktop Server restart, refresh it through the named connection bridge; never replay an ambiguous failed mutation automatically, and recover Agent views from durable Run/Message/Schema state.
- Preview uses the read-only preview bridge, never a fallback that requests desktop credentials. Rendering errors must remain visible without corrupting the editing session.

## Interaction contract

- Use HeroUI foundations, Tailwind and Lucide under root rules; consult installed APIs and existing usage rather than assuming another major version.
- Conversation/editor share one page context. The editor already loads and mutates Working Schema; keep that authority in the service-backed editor session rather than duplicating it in Workspace state.
- Editor fills the work area; overlay navigation must not resize the canvas. When editable state returns, flush pending edits before page/mode switches and preview, block transitions on save failure and safely clear invalid selections after Schema changes.
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

- Extend `src/components/workspace/state/view-session.test.ts` and `src/services/request.test.ts` for affected transitions/transport; add focused tests beside new stateful logic.
- Web host/proxy changes: `pnpm --filter @origamix/app test:web`. Supervisor/rebuild changes: also `pnpm --filter @origamix/server test:dev`.
- Use `pnpm dev:web` for browser interaction checks. Directory pickers, settings and independent windows need `pnpm dev` and Desktop smoke checks, not only browser screenshots.
- Run root gates before handoff and report both-theme interaction evidence. Existing unit/smoke tests are not complete visual coverage.
