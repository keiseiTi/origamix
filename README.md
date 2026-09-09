# Origamix

Browser- and desktop-capable low-code editor. The Electron distribution integrates the UI, backend lifecycle, native directory access and template resources; the browser application can connect to a separately deployed backend and uses browser download/import flows for project templates.

## Workspace

| Package              | Responsibility                                                                          |
| -------------------- | --------------------------------------------------------------------------------------- |
| `apps/desktop`       | Electron Main/Preload, desktop development orchestration and application packaging      |
| `packages/app`       | React Renderer; no direct Node.js/Electron imports                                      |
| `packages/materials` | Source-only Tangramino page materials and editor manifests; currently Ant Design only   |
| `packages/server`    | SQLite, project persistence, HTTP API and independently built server artifacts          |
| `packages/shared`    | Source-only TypeScript contracts and validation shared by consumers                     |
| `packages/template`  | Portable project scaffold with its own dependencies and strict TypeScript configuration |

Each package declares its own direct runtime dependencies. Shared lint/typecheck/test tools live at the workspace root; the template keeps its own tools so generated projects work outside this repository. Full dependency hoisting is disabled. Shared source is compiled by its consumers; the server owns its `dist` output and Desktop assembles it without compiling server source itself.

## Development

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Dependency installation also installs the repository's Lefthook `pre-commit` hook. Like lint-staged, it formats only staged text files, lints only staged application code and re-stages the processed files after successful fixes. Typecheck and tests run only when staged application or package files include TypeScript. Run the hook against the current staged files without committing, or reinstall it, with:

```sh
pnpm hooks:run
pnpm hooks:install
```

Desktop development starts the server compiler, Renderer and Electron. Main/Preload/Server changes rebuild and restart Electron; Renderer changes use Vite HMR. The default Renderer port is 5173 and must be available. VS Code's desktop launch configuration starts the same development script.

```sh
pnpm dev:web
```

Web development first builds the Server, then starts a local backend through Vite. Running `pnpm --filter @origamix/app dev` directly uses the same workflow, including on a clean checkout. Server/Shared changes rebuild the backend and restart Vite; Renderer changes retain Vite HMR. `/api/v1` is a same-origin proxy; its authentication token stays on the development host. Backend data is stored in ignored `.origamix-web/`, separately from Electron user data. `ORIGAMIX_WEB_STATE_DIR` overrides that directory. To edit an existing project, explicitly provide its directory on the host:

```sh
ORIGAMIX_WEB_PROJECT_DIR=/absolute/path/to/project pnpm dev:web
```

Project selection, open tabs, the active tab, each tab's chat/edit mode and unsent chat drafts belong to the current UI window and are restored from `sessionStorage` after refresh. They are not persisted by the backend. Current builds still edit project Schema files directly; the target workflow separates editable Working Revisions from the managed target `schema.json`, which changes only when the user chooses “应用到项目”. See `_doc/PROJECT-APPLY-ARCHITECTURE.md`.

Desktop and browser hosts expose different capabilities:

- Desktop owns native directory pickers, bundled template installation, local backend startup, credentials and independent preview windows.
- Browser deployments connect to a configured backend. Template/project acquisition must use explicit browser download/import APIs; it must not emulate native paths or depend on Electron bridges.

The current `dev:web` command is the local browser-development composition of these boundaries. It does not itself expose arbitrary host filesystem access or constitute the production remote deployment configuration.

For standalone backend development, set `ORIGAMIX_SERVER_TOKEN` and run `pnpm --filter @origamix/server dev`. It builds on startup, watches Server/Shared source and restarts after successful builds. The console reports the assigned loopback port and service instance ID after each restart; clients must send both the bearer token and `X-Origamix-Service` header. App and Server supervisors stop their workers and compiler on exit.

## Verification and packaging

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm gate:internal
pnpm package
```

`pnpm build` builds workspace dependencies once, assembles Desktop and creates an unsigned, unpacked application for the current platform in ignored `release/`. For independent use, Desktop's `build` still builds Server before assembly; `build:app`, `build:assemble` and `package:assemble` are internal steps that expect their input artifacts to exist.

`pnpm package` runs all checks and the desktop build before creating installable distributions. `pnpm --filter @origamix/desktop package --dir` also rebuilds its inputs and produces only an unpacked application. Platform signing credentials must be configured separately for distribution; the normal build intentionally disables automatic macOS certificate discovery so local builds do not prompt for signing credentials.

The packaged Renderer uses relative asset URLs for `file://`. Main/Preload/Server live inside `app.asar`; Renderer and the clean project template are external resources. The template copier includes only scaffold files and excludes dependency directories, generated output, secrets, caches and symlinks. Icons are maintained in `build/` only.

Additional integration checks:

```sh
pnpm --filter @origamix/app test:web
pnpm --filter @origamix/server test:template
pnpm --filter @origamix/server test:dev
pnpm --filter @origamix/desktop test:smoke
# After packaging on macOS, test the packaged resources with the installed Electron runtime:
pnpm --filter @origamix/desktop test:smoke /absolute/path/to/Origamix.app/Contents/Resources
```

The default Electron smoke check requires Desktop's compiled artifacts (produced by `pnpm build` or `pnpm --filter @origamix/desktop build`) and a graphical session. It loads the real compiled Main entry, uses its real IPC handlers and SQLite backend, and verifies workspace restoration, project creation, preview isolation, dark-theme persistence and graceful shutdown. Only the OS directory picker is replaced with a temporary test directory. Supplying a Resources path runs the separate packaged-resource smoke check; it is not an end-to-end launch of a signed installer.

`test:dev` copies source to a temporary workspace (reusing installed dependencies), starts App without Server artifacts, changes only temporary source and verifies Web/Server restarts and listener cleanup. The template check installs dependencies in a temporary generated project, so it requires registry access or a populated pnpm cache.
