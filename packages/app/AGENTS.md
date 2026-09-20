# App harness

Applies to `packages/app/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- `src/app.tsx`, `src/components/`: React workbench and interactions.
- `src/services/request.ts` and sibling services: typed HTTP requests and errors.
- `src/store/`: window-scoped workspace and preference projections; `pending-operations.ts` retains unresolved Apply/Agent request identities in memory across view unmounts.
- `src/hooks/`: cross-component workflow orchestration; feature-owned editor, Agent and Apply sessions remain beside their components.
- `src/components/agent-chat/`, `src/components/editor/`, `src/components/settings/`: feature-owned UI and state.
- `src/components/editor/`: editing UI and its save session; `src/runtime/` and `src/components/workspace/page-preview-frame.tsx`: reusable runtime rendering and the retained iframe preview surface.
- `dev-server.ts`, `vite.config.ts`, `scripts/`: Node-side Web development tooling, not Renderer code.

## Runtime boundaries

- Nothing under `src/` may import Node.js, Electron, Server or Desktop implementations. Use the typed optional desktop bridge and service-layer business requests.
- The Node development host may import `@origamix/server/runtime`. Never import host modules into browser source or expose tokens via `VITE_*`, Vite `define`, HTML or localStorage.
- App HTML intentionally does not define a Content Security Policy. Treat all external, project and Agent content as untrusted: render text through React escaping, reject unsafe URL schemes and do not introduce raw HTML or dynamic code execution without an explicit sanitizer, focused security tests and a documented review. Server Origin/CORS checks and session credentials protect HTTP access; they do not sanitize Renderer content.
- The Renderer supports both browser and desktop hosts. Keep project/tab navigation and per-tab UI state in window `sessionStorage`; never send that state to Server. Desktop may integrate directory pickers, template installation, backend lifecycle and independent windows. Production browser HTTP configuration and download/import acquisition remain unimplemented; do not document the local development proxy as those capabilities. Unsupported host capabilities need clear disabled/error states, not fake success.
- Keep directory selection and the conditional initialization form in one feature-owned open-project flow. Select the directory first: an existing manifest is opened after missing fields are completed with defaults, while an absent manifest prompts for initialization details.
- React state and Zustand are projections. Schema mutation goes through Server; update the Working projection only after success. The visual editor derives typed Operation Batches from engine snapshots and automatically retains the resulting version-checked Working draft; protocol gaps may use the internal full-candidate fallback. The user explicitly creates Revision checkpoints with “保存版本”. Working draft persistence, Revision checkpoints and applied-to-project state are distinct. Never persist authoritative Schema in a component, store or browser storage; Agent completion, saving a version and restoring history must not auto-apply.
- Components subscribe to Zustand projections at the level that consumes them instead of passing Store state or actions through parents. Use selectors, use `useShallow` when one component selects multiple fields, and extract a feature-specific custom Hook only when the same selector is genuinely repeated; never subscribe to the whole Store for convenience. Keep props for component inputs, callbacks that coordinate multiple owners and state that is not owned by the Store.
- Associate asynchronous work with page identity and revision; stale results must not overwrite another page. Preserve pending edits on failure.
- Resolve edit, preview, Agent, Apply and explicit project reload actions with `projectId` plus stable `pageId`; page names are display labels, not identity. A reload that discards Working Schema needs an explicit user confirmation, and late responses from another page must be ignored.
- Keep Workspace polling, save and Apply projections in the page-bound application-state hook keyed by projectId/pageId and, where relevant, revisionId. Ignore late responses for inactive pages instead of letting view components reconcile them ad hoc.
- Agent recovery starts as unknown and blocks editing, undo, Apply and new submissions until authority is loaded; failures must retain a visible retry path. Pending operation records are never written to browser storage, and remounting must not automatically replay a mutation.
- Retain one Apply request ID for the same page Revision and Working version until the result is known; an ambiguous transport failure must not turn an explicit retry into a different logical operation. Apply is available only for a clean, explicitly saved Revision.
- Renderer transports cache backend authority only as a convenience. After a desktop Server restart, refresh it through the named connection bridge; never replay an ambiguous failed mutation automatically, and recover Agent views from durable Run/Message/Schema state.
- Preview data access stays in the trusted workbench and renders through a portal into a sandboxed iframe. Never expose Desktop credentials or a broad bridge to the iframe. Rendering errors must remain visible without corrupting the editing session.

## Interaction contract

- Use the repository-owned shadcn/ui components in `src/components/ui/`, backed by Base UI, with Tailwind and Lucide under root rules. Feature code uses the generated shadcn APIs directly and must not import Base UI primitives or add compatibility APIs for replaced component libraries.
- Conversation/editor share one page context. The editor already loads and mutates Working Schema; keep that authority in the service-backed editor session rather than duplicating it in Workspace state.
- Revision history is page-scoped and loaded on demand. Listing returns metadata; viewing fetches one immutable snapshot, while restoring copies it into Working as an unsaved draft. History actions never auto-save or auto-apply.
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

- App automation is limited to browser-owned core-flow risks that Server cannot prove: stale page responses, failed-save draft retention, stable retry identity, recovery and transition blocking. Prefer extending an existing workflow scenario. Do not add tests for presentation components, layout, ordinary request forwarding or component composition.
- Add a new App scenario only for a distinct uncovered workflow risk, and record why existing workflow coverage cannot express it. Keep new tests under `test/` mirroring their source area.
- Web host/proxy changes: `pnpm --filter @origamix/app test:web`. Supervisor/rebuild changes: also `pnpm --filter @origamix/server test:dev`.
- Use `pnpm dev:web` for browser interaction checks. Directory pickers, settings and independent windows need `pnpm dev` and Desktop smoke checks, not only browser screenshots.
- Run root gates before handoff and report both-theme interaction evidence. Existing unit/smoke tests are not complete visual coverage.
