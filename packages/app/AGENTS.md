# App harness

Applies to `packages/app/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- `src/app.tsx` coordinates page transitions and global dialogs; `src/components/app-layout/index.tsx` composes the left Sidebar and right Workspace.
- `src/components/workspace/index.tsx` owns restoration and the top/content structure; `page-tabs.tsx` owns the top tab bar, and `workspace-content.tsx` selects restoration, empty and retained page sessions. `page-session.tsx` owns each retained page session and chat/edit/preview views; `page-toolbar.tsx`, `toolbar/`, `history/` and `preview/` own its controls and auxiliary surfaces.
- `src/components/sidebar/sidebar-navigation.tsx` owns Sidebar and SidebarToggle with one `useSidebarNavigation` instance; its narrow ref handle closes temporary navigation for page selection and global dialogs. Mode changes preserve the user-selected sidebar collapse preference. Persisted collapse preferences remain in the preferences store.
- `src/services/request.ts` and sibling services: typed HTTP requests and errors.
- `src/store/`: window-scoped workspace and preference projections; `pending-operations.ts` retains unresolved Apply/Agent request identities in memory across view unmounts.
- `src/hooks/`: cross-component workflow orchestration; feature-owned editor, Agent and Apply sessions remain beside their components.
- `src/components/agent-chat/`, `src/components/settings/`: feature-owned UI and state; `src/components/editor/` owns only host composition and persistence coordination.
- `@origamix/editor` internal FlowEditor: LogicFlow canvas, compact React nodes, accordion event tree/node palette and event graph translation; event entry comes from the selected material’s `contextConfig.events`. Declarative actions execute in Runtime. Layouts live in Schema extensions and share the existing Working save session. Palette nodes use LogicFlow DnD (Enter/Space also adds at canvas center); edges connect through canvas anchors. Canvas-scoped Delete/Backspace preserves the start node, and keyboard undo/redo commits through the same Working pipeline. The page toolbar switches edit submodes `view`/`logic`; both retain one EditorProvider and flush pending edits before switching.
- Flow node types, titles, descriptions, insertion defaults, execution status and connection metadata come from `@origamix/shared`. Editor owns the forms and reads property choices/bounds from that catalog; do not maintain a second node catalog. Clone defaults before editing nested setter drafts.
- `src/components/editor/`: App-owned PageEditor composition, concrete material registration and HTTP-backed Working session; editing implementation lives in `@origamix/editor`; `src/preview/` and `src/components/workspace/preview/page-preview-frame.tsx`: reusable runtime rendering and the retained iframe preview surface.
- `dev-server.ts`, `vite.config.ts`, `scripts/`: Node-side Web development tooling, not Renderer code.

- `@origamix/editor` provides public mode, tool, history and command-handle types. Canvas, panels and FlowEditor belong to Editor. See the [architecture contract](../../site/docs/architecture/development.md) for ownership boundaries; HTTP and Working sessions remain in App.

## Runtime boundaries

- Workbench routes use browser paths over HTTP and hash routes for Desktop `file:` documents. Build iframe URLs from the current document in file mode, preserving the compiled index path; never use the opaque file origin as a URL base. The real Desktop smoke checks actual iframe material rendering and the absence of a bridge.

- `src/materials/` owns the literal built-in import allowlist and async editor registration. Resolve stack through `projectsService.stack`, load editor materials only in editing mode, and keep module caches keyed by material-set identity/version. Rejected loads must remain retryable; a previous project's completion must not install a registration into the current project. Delay Working-session readiness until the material registration mounts. Preview receives the resolved stack only in host snapshots and loads runtime separately without credentials or HTTP.

- App bootstrap `src/components/editor/monaco-workers.ts` configures Vite workers. Pass theme to standalone Editor components such as history CodeEditor; Editor cannot read App preferences. Editor stores are provider-scoped. Mount canvas UI only for the active editing page to preserve existing page activation and portal lifecycle behavior. PageEditor remounts its session on page activation and mode changes after the transition flush, so inactive pages and chat/preview never retain canvas portals. Its persistence hook remains available for recovery/flush. Each page owns a separate Working queue; failed drafts remain visible, and typing must not automatically replay a failed/ambiguous write.

- Nothing under `src/` may import Node.js, Electron, Server or Desktop implementations. Use the typed optional desktop bridge and service-layer business requests.
- The Node development host may import `@origamix/server/runtime`. Never import host modules into browser source or expose tokens via `VITE_*`, Vite `define`, HTML or localStorage.
- App HTML intentionally does not define a Content Security Policy. Treat all external, project and Agent content as untrusted: render text through React escaping, reject unsafe URL schemes and do not introduce raw HTML or dynamic code execution without an explicit sanitizer, focused security tests and a documented review. Server Origin/CORS checks and session credentials protect HTTP access; they do not sanitize Renderer content.
- The Renderer supports both browser and desktop hosts. Keep project/tab navigation and per-tab UI state in window `sessionStorage`; never send that state to Server. Desktop may integrate directory pickers, template installation, backend lifecycle and independent windows. Production browser HTTP configuration and download/import acquisition remain unimplemented; do not document the local development proxy as those capabilities. Unsupported host capabilities need clear disabled/error states, not fake success.
- `src/store/workspace.ts` owns open-tab navigation and per-tab mode. Its lifecycle status is a transient projection of the page-bound Server apply state: restore it as unknown and never trust a status saved in the window session.
- Keep directory selection and the conditional initialization form in one feature-owned open-project flow. Select the directory first: an existing manifest is opened after missing fields are completed with defaults, while an absent manifest prompts for initialization details.
- React state and Zustand are projections. Schema mutation goes through Server; update the Working projection only after success. The visual editor derives typed Operation Batches from engine snapshots and automatically retains the resulting version-checked Working draft; protocol gaps may use the internal full-candidate fallback. The user explicitly creates Revision checkpoints with the explicit Save Revision action. Working draft persistence, Revision checkpoints and applied-to-project state are distinct. Never persist authoritative Schema in a component, store or browser storage; Agent completion, saving a version and restoring history must not auto-apply.
- Components subscribe to Zustand projections at the level that consumes them instead of passing Store state or actions through parents. Use selectors, use `useShallow` when one component selects multiple fields, and extract a feature-specific custom Hook only when the same selector is genuinely repeated; never subscribe to the whole Store for convenience. Keep props for component inputs, callbacks that coordinate multiple owners and state that is not owned by the Store.
- Associate asynchronous work with page identity and revision; stale results must not overwrite another page. Preserve pending edits on failure.
- Resolve edit, preview, Agent, Apply and explicit project reload actions with `projectId` plus stable `pageId`; page names are display labels, not identity. A reload that discards Working Schema needs an explicit user confirmation, and late responses from another page must be ignored.
- JSON business requests use named POST operations and carry project/page scope, resource IDs and pagination in validated request bodies. `src/services/request.ts` serializes those bodies once. Agent SSE and health checks remain GET.
- Keep Workspace apply-state reads, save and Apply projections in the page-bound application-state hook keyed by projectId/pageId and, where relevant, revisionId. Refresh on page or Schema changes and explicit actions; ignore late responses for inactive pages instead of letting view components reconcile them ad hoc.
- Agent recovery starts as unknown and blocks editing, undo, Apply and new submissions until authority is loaded; failures must retain a visible retry path. Pending operation records are never written to browser storage, and remounting must not automatically replay a mutation.
- Agent SSE is a transient typed projection only. Working refreshes exclusively from a committed Working version, while non-writing outcomes never refresh Schema. Reconnect and fast completion converge through durable Run/Message state; ignore events whose Run or page does not match the mounted session.
- Structured clarification choices remain bound to their source Run and base Working version. Expired choices are disabled and Canvas markers removed; selection requests carry the clarification identity and selected Element ID for Server revalidation.
- Retain one Apply request ID for the same page Revision and Working version until the result is known; an ambiguous transport failure must not turn an explicit retry into a different logical operation. Apply is available only for a clean, explicitly saved Revision.
- Renderer transports cache backend authority only as a convenience. After a desktop Server restart, refresh it through the named connection bridge; never replay an ambiguous failed mutation automatically, and recover Agent views from durable Run/Message/Schema state.
- Preview data access stays in the trusted workbench and sends page snapshots via postMessage to a sandboxed iframe. Never expose Desktop credentials or a broad bridge to the iframe. Rendering errors must remain visible without corrupting the editing session.

## Interaction contract

- `index.html` opts the workbench/preview document into `origamix-ui`; shared palette and foundation styles come from `@origamix/ui/styles.css`. App keeps status colors, scrollbar, layout and theme preference. Keep UI primitives and their generator aliases in the UI package rather than recreating `src/components/ui/`.

- Use the shared shadcn/ui components through `@origamix/ui`, backed by Base UI, with Tailwind and Lucide under root rules. Feature code uses the generated shadcn APIs directly and must not import Base UI primitives or add compatibility APIs for replaced component libraries.
- `src/main.css` explicitly includes Materials' Ant Design source in Tailwind scanning. Keep this source declaration when adding package-owned canvas classes; workbench input controls are owned by UI; `@origamix/ui/styles.css` scans its own sources.
- Conversation/editor share one page context. The editor already loads and mutates Working Schema; keep that authority in the service-backed editor session rather than duplicating it in Workspace state.
- Revision history is page-scoped and loaded on demand. Listing returns metadata; viewing fetches one immutable snapshot, while restoring copies it into Working as an unsaved draft. History actions never auto-save or auto-apply.
- Editor fills the work area; overlay navigation must not resize the canvas. When editable state returns, flush pending edits before page/mode switches and preview, block transitions on save failure and safely clear invalid selections after Schema changes.
- Include keyboard operation, overlay focus restoration, Esc dismissal, loading/empty/error states and save feedback. Keep the fixed composer and overlays usable at narrow widths.
- Verify affected surfaces in light and dark themes, including preview and disabled/error states. Avoid hard-coded light-only colors.
- These are acceptance constraints for relevant changes, not claims that all planned editor/Agent features exist. Do not add AI implementation unless requested. Event flow node definitions and forms live in `packages/editor/src/flow-editor/nodes/`. Match the reference node types for requests, properties, methods, visibility, conditions, variables and portal actions; values use Shared HyperValue envelopes. Expressions/functions and customJS execute exclusively in the sandboxed preview or generated page through Runtime; never evaluate them in the trusted workbench.

## Verification

From the repository root:

```sh
pnpm --filter @origamix/app lint
pnpm --filter @origamix/materials... build
pnpm --filter @origamix/app typecheck
pnpm --filter @origamix/app test
pnpm --filter @origamix/app build
```

- App automation is limited to browser-owned core-flow risks that Server cannot prove: stale page responses, failed-save draft retention, stable retry identity, recovery and transition blocking. Prefer extending an existing workflow scenario. Do not add tests for presentation components, layout, ordinary request forwarding or component composition.
- Add a new App scenario only for a distinct uncovered workflow risk, and record why existing workflow coverage cannot express it. Keep new tests under `test/` mirroring their source area.
- Web host/proxy changes: `pnpm --filter @origamix/app test:web`. Supervisor/rebuild changes: also `pnpm --filter @origamix/server test:dev`.
- Use `pnpm dev:web` for browser interaction checks. Directory pickers, settings and independent windows need `pnpm dev` and Desktop smoke checks, not only browser screenshots.
- Run root gates before handoff and report both-theme interaction evidence. Existing unit/smoke tests are not complete visual coverage.

- Map Agent clarification candidates and expiry to Editor `targetSelection` in the page host; keep all Run/clarification business decisions here. Supply the specific read-only reason rather than making Editor infer Agent state.

- Editor logic-mode changes request immediate Working queue admission via the change callback; retain the same version checks, serial queue, failed-draft retention and explicit retry behavior as visual edits. Node position, properties, node/edge insertion/deletion and edge adjustment are draft changes, never Revision requests.
- Runtime material loading returns components and the material-family Provider together; preview passes the snapshot theme to that Provider so Ant Design text, controls and portals match the host theme.

- Material loaders register rootMaterials/rootManifests separately from draggable groups. Keep the root in Editor and validation context without allowing duplicate root insertion; runtime loading still returns the standalone components and Provider together.

- `src/canvas-prototype/` and `canvas-prototype-plugin.ts` implement the standalone `/canvas-prototype` experiment. They handle example in-memory snapshots only, without user projects or new persistence; this is not the production canvas protocol. Bundle the canvas offline into an allow-scripts-only srcdoc, without same-origin, network or Desktop bridge privileges. Its scope/version/command validator must reject stale instances, wrong pages and undeclared capabilities. Move the full contract to Shared and connect the existing Working queue only during a production migration.

- The project menu's upgrade dialog reads durable upgrade status, keeps the request ID on failures, and resumes only on explicit user action. It flushes local edits but never saves Revisions automatically. Close/reopen recovers pending identity from Server. Completion tells users to reinstall dependencies; the UI never runs a package manager.

- The Node-only web host prepares a vendored template under ORIGAMIX_WEB_STATE_DIR using Server's exported template-artifact tooling. Do not send source-only templates or workspace dependency paths to the project upgrade service.

- Package `config.ts` owns Node-only development settings from `.env` / optional `.env.local` / process overrides. Vite envDir is disabled; do not expose the entire env or VITE_* from these files to Renderer. Desktop injects its renderer host/port and host mode. Tests set ORIGAMIX_ENV_LOCAL=0.

- In Desktop mode, Vite ignores Materials/Shared/Runtime changes: the Desktop supervisor rebuilds dependencies and restarts the development instance after preparing matching artifacts instead of refreshing Renderer against an older running backend. App/Editor/UI retain source HMR. Keep this coordination in Node-side tooling, without adding development lifecycle methods to the product bridge or business sessions.

- Default backend port is 1029 and Renderer development port is 9685. Hosts parse ORIGAMIX_SERVER_PORT and pass it into startServer; explicit 0 is reserved for OS-assigned ports in isolated integrations. Keep loopback-only binding and fail on occupied ports; never connect to or kill the occupying process. Fixed ports do not change the existing development restart policy.

- App owns one backend-status subscription. On replacement invalidate the in-memory connection generation; old getConnection replies and late HTTP responses cannot install stale authority or confirm a write. Recovery re-reads durable state and reconnects SSE, preserving pending request identities and editor drafts. Never use ApiRequestError for an ambiguous replaced-service response, since 4xx handling can retire retry identities.
