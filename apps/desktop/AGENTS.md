# Desktop harness

Applies to `apps/desktop/`. Read the [root guide](../../AGENTS.md) first.

## Ownership and entry points

- `src/main/index.ts`: application lifecycle, directory grants, settings/credentials and backend bootstrap.
- `src/preload/index.ts`: workbench bridge. Page previews are Renderer-owned sandboxed iframe documents and do not have a Desktop bridge.
- `scripts/dev.mjs`, `scripts/build.mjs`, `scripts/build-options.mjs`, `scripts/assemble-resources.mjs`, `scripts/copy-server-artifact.mjs`, `electron-builder.yml`: supervision, compilation and resource assembly. Template npm-version preparation comes from Server tooling rather than a Desktop-owned recipe.

## Boundaries

- Main is the desktop host, not a second business backend. Project CRUD, SQL and Schema commits belong to Server; contracts belong to Shared.
- `src/main/workbench-security.ts` owns trusted-document and IPC caller checks. Register privileged handlers through the Main workbench wrapper, which requires the owned window, its main frame and the configured entry document. Block navigation/redirects to other documents; only HTTP(S) new-window URLs may open externally. Hash routing within the entry document remains supported.
- Expose only named domain methods through `contextBridge`. Validate payloads and sending window/frame before privileged operations; types alone do not authorize callers.
- Keep `nodeIntegration: false`, `contextIsolation: true` and preview sandboxing. Restrict navigation, new windows and permissions; load trusted application routes, not Renderer-provided URLs or paths.
- Directory pickers return grants for Backend use. Keep credentials under Main's safeStorage ownership; previews and logs receive neither secrets nor desktop tokens.
- Main owns the selected Agent model and its credential. The Server Utility Process requests the current model reference when starting each Run, so settings changes apply to the next Run without restarting the backend; persist the chosen reference on that Run.
- Page tabs and their retained iframe previews belong to the Renderer. Main must not own page-tab state or create a second preview-window lifecycle. Preview data access stays in the trusted workbench; the iframe document receives page snapshots through postMessage and has no Desktop bridge or backend credentials.
- Use exported Server build/runtime entry points. Server compiles its own artifacts; Desktop assembles them. Do not import Server business implementation into Main or create another Server compiler configuration.
- Clean up owned handlers, windows, timers, watchers and child processes on shutdown/restart. Never kill unrelated processes to free a port.
- An unexpected Server Utility Process exit is recovered through the serialized backend bootstrap in Main. The replacement must receive a fresh token and service-instance ID; intentional application shutdown must never trigger that restart path.

## Build and package contract

- Root `pnpm build` builds required workspace packages and assembles Desktop resources, stopping at `dist`. Desktop delivery currently targets macOS 13+ arm64 only. Root `pnpm package:dir` creates a locally ad-hoc-signed unpacked application; `pnpm package:mac` (also invoked by `pnpm package`) creates DMG and ZIP trial builds after all checks. Package commands explicitly select macOS/arm64 and disable publishing. Keep the local ad-hoc profile distinct from Developer ID signing/notarization; `hardenedRuntime: false` belongs to this trial profile and must be reviewed when preparing public signed releases. Package-local `build` compiles Main/Preload and assembles existing Server/library inputs; root `build` prepares those inputs in order. Package-local `package:dir` / `package:mac` only package existing resources; use root commands for a complete build.
- Main/Preload/Server ship as self-contained bundles in `app.asar`; electron-builder excludes the duplicate `node_modules` tree, enforced by `test:resources`; Renderer and the clean template are external resources. Preserve development/packaged path resolution, relative Renderer assets and the template allowlist.
- Maintain icons in root `build/`. Do not repair packaging by patching generated `dist/` or `release/`.

## Verification

From the repository root:

```sh
pnpm --filter @origamix/desktop lint
pnpm --filter @origamix/desktop typecheck
pnpm --filter @origamix/desktop test
pnpm build
pnpm --filter @origamix/desktop test:main
```

- The Main integration check needs compiled artifacts and a graphical session. It exercises real Main/IPC/backend paths with a temporary directory picker. Verify iframe preview isolation, theme persistence and shutdown when changed.
- `evaluate:agent` is an opt-in, billable live-model quality run, not a default test. Its harness reuses real Main credential injection with copied encrypted settings and temporary app/project state. Preserve failure reports, nonzero failure exits, cleanup and the distinction between automated evidence and manual visual acceptance; never replace provider results with fixed observations to obtain a pass. Usage limitations and invocation belong in the Desktop README.
- The preview smoke must wait for a material rendered inside the iframe, not a workbench overlay. Preview exit controls belong to the host; file-mode Renderer routing must keep the built index document reachable.
- For packaging changes, also run `pnpm package:dir` and the packaged-resource check in the root README. Resource checks do not prove signed-installer launch.
- Run root gates before handoff; report unavailable graphical or signing checks.

- `test:main` also verifies actual `/canvas-prototype` rendering in file mode, an opaque origin, no parent DOM access and no Desktop bridge. This proves prototype resource and permission boundaries, not delivery of a fully isolated editor.

- Desktop development prepares the same npm-pinned template as packaged builds before launching Electron and points ORIGAMIX_TEMPLATE_DIR at dist/template. Keep preparation delegated to Server tooling; source templates use workspace dependencies, which preparation pins to registry versions.

- `src/main/config.ts` owns Desktop env parsing and resolved paths. Dev scripts load package `.env` then optional `.env.local`, with process overrides; the packaged Main reads only shipped `dist/.env`. Build/resource assembly must copy only `.env`, never personal files. Renderer navigation and IPC authority must use the same resolved entry.

- Desktop development watches Shared/Runtime/Materials/Server/Main/Preload sources and build configurations, rebuilding dependencies in order. App/Editor/UI retain HMR. Stage fresh resources after ordered builds, then gracefully stop Electron and Vite before replacing artifacts and restarting. Build failures preserve the live instance; exit timeout pauses updates without force-killing Electron. The terminal p command pauses/resumes automatic restart. Do not promise transient draft or Agent continuity across a development restart. Keep development tooling out of Renderer business sessions and the public desktop bridge. `pnpm test:dev` checks this lifecycle and listener cleanup. Main passes the trusted document origin to Server, including configured development ports.

- Build and publication ownership follows [package artifact contract](../../site/docs/architecture/development.md). Materials npm output contains only public runtime/Manifest artifacts; UI/Editor stay private. Template dependencies use exact registry versions, never production vendor archives.
