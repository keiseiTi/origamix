# Desktop harness

Applies to `apps/desktop/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- `src/main/index.ts`: application lifecycle, directory grants, settings/credentials and backend bootstrap.
- `src/main/page-windows.ts`: page preview `WebContentsView` ownership, reuse and read authorization.
- `src/preload/index.ts`: workbench bridge; `src/preload/preview.ts`: separate read-only preview bridge.
- `scripts/dev.mjs`, `scripts/build.mjs`, `scripts/tsup-options.mjs`, `electron-builder.yml`: supervision, compilation and resource assembly. Template vendor preparation comes from Server tooling rather than a Desktop-owned recipe.

## Boundaries

- Main is the desktop host, not a second business backend. Project CRUD, SQL and Schema commits belong to Server; contracts belong to Shared.
- Expose only named domain methods through `contextBridge`. Validate payloads and sending window/frame before privileged operations; types alone do not authorize callers.
- Keep `nodeIntegration: false`, `contextIsolation: true` and preview sandboxing. Restrict navigation, new windows and permissions; load trusted application routes, not Renderer-provided URLs or paths.
- Directory pickers return grants for Backend use. Keep credentials under Main's safeStorage ownership; previews and logs receive neither secrets nor desktop tokens.
- Page tabs belong to the Renderer. Main overlays the active page with one sandboxed `WebContentsView` in preview mode, keyed by project and page. Serialize concurrent open requests, validate page/project membership, resize the active view with the workbench and explicitly close owned web contents with the window. Exiting preview removes the view without closing the workbench or losing drafts.
- Current preview transport is `window.preview.readSnapshot()`: Main binds requests to a registered preview window and fetches its target Schema over authenticated HTTP. It exposes no backend connection to preview. HTTP/SSE preview capability sessions in the ADR are planned, not implemented; do not introduce a broad bridge to approximate them.
- Use exported Server build/runtime entry points. Server compiles its own artifacts; Desktop assembles them. Do not import Server business implementation into Main or create another Server compiler configuration.
- Clean up owned handlers, windows, timers, watchers and child processes on shutdown/restart. Never kill unrelated processes to free a port.
- An unexpected Server Utility Process exit is recovered through the serialized backend bootstrap in Main. The replacement must receive a fresh token and service-instance ID; intentional application shutdown must never trigger that restart path.

## Build and package contract

- Root `pnpm build:desktop` (and its `pnpm build` compatibility alias) builds required workspace packages directly, assembles Desktop and creates an unsigned, unpacked current-platform application. It does not consume public npm tarballs. `pnpm --filter @origamix/desktop build` builds Server then assembles Desktop without packaging; `build:app`, `build:assemble` and `package:assemble` are internal steps that require existing artifacts.
- Main/Preload/Server ship in `app.asar`; Renderer and the clean template are external resources. Preserve development/packaged path resolution, relative Renderer assets and the template allowlist.
- Maintain icons in root `build/`. Do not repair packaging by patching generated `dist/` or `release/`.

## Verification

From the repository root:

```sh
pnpm --filter @origamix/desktop lint
pnpm --filter @origamix/desktop typecheck
pnpm --filter @origamix/desktop test
pnpm build
pnpm --filter @origamix/desktop test:smoke
```

- Extend `src/main/page-windows.test.ts` for lifecycle and preview-boundary regressions.
- Default smoke needs compiled artifacts and a graphical session. It exercises real Main/IPC/backend paths with a temporary directory picker. Verify window reuse, denied preview access, theme persistence and shutdown when changed.
- For packaging changes, also run `pnpm --filter @origamix/desktop package --dir` and the packaged-resource smoke command in the root README. Resource checks do not prove signed-installer launch.
- Run root gates before handoff; report unavailable graphical or signing checks.
