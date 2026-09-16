# Origamix

Browser- and desktop-capable low-code editor. The Electron distribution integrates the UI, backend lifecycle, native directory access and template resources; the browser application can connect to a separately deployed backend and uses browser download/import flows for project templates.

## Workspace

| Package              | Responsibility                                                                          |
| -------------------- | --------------------------------------------------------------------------------------- |
| `apps/desktop`       | Electron Main/Preload, desktop development orchestration and application packaging      |
| `packages/app`       | React Renderer; no direct Node.js/Electron imports                                      |
| `packages/materials` | Publishable Tangramino page materials and editor manifests; currently Ant Design only   |
| `packages/server`    | SQLite, project persistence, HTTP API and independently built server artifacts          |
| `packages/shared`    | Publishable TypeScript contracts and validation shared by consumers                     |
| `packages/template`  | Portable project scaffold with its own dependencies and strict TypeScript configuration |

Each package declares its own direct runtime dependencies. Shared lint/typecheck/test tools live at the workspace root; the template keeps its own tools so generated projects work outside this repository. Full dependency hoisting is disabled. Shared, Runtime and Materials emit independently publishable `dist` output; the server owns its own `dist` output and Desktop assembles it without compiling server source itself.

## Development

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Dependency installation also installs the repository's Lefthook `pre-commit` hook. Like lint-staged, it formats only staged text files, lints only staged application code and re-stages the processed files after successful fixes. Typecheck and package tests run when staged application or package files include TypeScript. Changes to the Server architecture rule or ESLint configuration also run the boundary-rule tests and lint Server. Run the hook against the current staged files without committing, or reinstall it, with:

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

`pnpm lint` includes Server import-boundary checks. `pnpm test` runs the Server-owned architecture-rule regression tests through the Server package; run `pnpm --filter @origamix/server test:architecture` to check only the rule. See [Server verification](packages/server/README.md#自动边界检查) for the enforced boundaries.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:web
pnpm gate:internal
pnpm package:dir
pnpm package
pnpm package:npm
```

`pnpm build` builds the local workspace dependencies, Renderer, Server and Desktop resources into their `dist` directories. It does not run electron-builder or consume public npm tarballs. Desktop and Server package-local `build` commands prepare their inputs before assembly; their `build:assemble` steps are internal commands used by the root build after those inputs already exist.

`pnpm build:web` builds Shared, Runtime and Materials from the workspace, then emits the standalone Renderer production assets to `packages/app/dist`. `pnpm build:libs` builds only the publishable Shared, Runtime and Materials packages.

`pnpm package:dir` builds and creates an unsigned unpacked application in ignored `release/`. `pnpm package` runs all checks and the build before creating installable distributions. Platform signing credentials must be configured separately for distribution; the directory package disables automatic macOS certificate discovery so local builds do not prompt for signing credentials.

`pnpm package:npm` builds Shared, Runtime and Materials, then creates publishable npm tarballs in `release/npm`. It does not publish them to a registry.

The packaged Renderer uses relative asset URLs for `file://`. Main/Preload/Server live inside `app.asar`; Renderer and the clean project template are external resources. The template copier includes only scaffold files and excludes dependency directories, generated output, secrets, caches and symlinks. Icons are maintained in `build/` only.

Additional integration checks:

```sh
pnpm --filter @origamix/app test:web
pnpm --filter @origamix/server test:template
pnpm --filter @origamix/server test:dev
pnpm --filter @origamix/desktop test:main
# After packaging on macOS, test the packaged resources with the installed Electron runtime:
pnpm --filter @origamix/desktop test:resources /absolute/path/to/Origamix.app/Contents/Resources
```

The Main Electron integration check requires Desktop's compiled artifacts and a graphical session. It loads the real compiled Main entry, uses its real IPC handlers and SQLite backend, and verifies workspace restoration, project creation, preview isolation, dark-theme persistence and graceful shutdown. Only the OS directory picker is replaced with a temporary test directory. The separate packaged-resource check validates an explicit Resources path; it is not an end-to-end launch of a signed installer.

`test:dev` copies source to a temporary workspace (reusing installed dependencies), starts App without Server artifacts, changes only temporary source and verifies Web/Server restarts and listener cleanup. The template check installs dependencies in a temporary generated project, so it requires registry access or a populated pnpm cache.
