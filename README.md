# Origamix

Local-first Electron low-code editor. Development uses custom tsup scripts and Vite; distribution uses electron-builder.

## Workspace

| Package             | Responsibility                                                                          |
| ------------------- | --------------------------------------------------------------------------------------- |
| `apps/desktop`      | Electron Main/Preload, desktop development orchestration and application packaging      |
| `packages/app`      | React Renderer; no direct Node.js/Electron imports                                      |
| `packages/server`   | SQLite, project persistence, HTTP API and independently built server artifacts          |
| `packages/shared`   | Source-only TypeScript contracts and validation shared by consumers                     |
| `packages/template` | Portable project scaffold with its own dependencies and strict TypeScript configuration |

Each package declares its own direct runtime dependencies. Shared lint/typecheck/test tools live at the workspace root; the template keeps its own tools so generated projects work outside this repository. Full dependency hoisting is disabled. Shared source is compiled by its consumers; the server owns its `dist` output and Desktop assembles it without compiling server source itself.

## Development

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Desktop development starts the server compiler, Renderer and Electron. Main/Preload/Server changes rebuild and restart Electron; Renderer changes use Vite HMR. The default Renderer port is 5173 and must be available. VS Code's desktop launch configuration starts the same development script.

```sh
pnpm dev:web
```

Web development first builds the Server, then starts a local backend through Vite. Running `pnpm --filter @origamix/app dev` directly uses the same workflow, including on a clean checkout. Server/Shared changes rebuild the backend and restart Vite; Renderer changes retain Vite HMR. `/api/v1` is a same-origin proxy; its authentication token stays on the development host. State is stored in ignored `.origamix-web/`, separately from Electron user data. `ORIGAMIX_WEB_STATE_DIR` overrides that directory. To edit an existing project, explicitly provide its directory on the host:

```sh
ORIGAMIX_WEB_PROJECT_DIR=/absolute/path/to/project pnpm dev:web
```

Native directory pickers, separate windows and desktop settings remain Electron-only. This is a local development mode, not a remotely deployable web service. It does not expose an HTTP endpoint that grants access to arbitrary filesystem paths.

For standalone backend development, set `ORIGAMIX_SERVER_TOKEN` and run `pnpm --filter @origamix/server dev`. It builds on startup, watches Server/Shared source and restarts after successful builds. The console reports the assigned loopback port and service instance ID after each restart; clients must send both the bearer token and `X-Origamix-Service` header. App and Server supervisors stop their workers and compiler on exit.

## Verification and packaging

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package
```

`pnpm build` builds workspace dependencies once, then runs Desktop's `build:assemble`. For independent use, Desktop's `build` still builds Server before assembly. `build:assemble` is an internal step and requires existing Server artifacts.

`pnpm package` runs checks, rebuilds the Renderer and desktop/server artifacts, and invokes electron-builder. `pnpm --filter @origamix/desktop package --dir` also rebuilds its inputs and produces an unpacked application. Outputs go to ignored `release/`. Platform signing credentials must be configured separately for distribution.

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

The default Electron smoke check requires `pnpm build` first and a graphical session. It loads the real compiled Main entry, uses its real IPC handlers and SQLite backend, and verifies workspace restoration, project creation, preview isolation, dark-theme persistence and graceful shutdown. Only the OS directory picker is replaced with a temporary test directory. Supplying a Resources path runs the separate packaged-resource smoke check; it is not an end-to-end launch of a signed installer.

`test:dev` copies source to a temporary workspace (reusing installed dependencies), starts App without Server artifacts, changes only temporary source and verifies Web/Server restarts and listener cleanup. The template check installs dependencies in a temporary generated project, so it requires registry access or a populated pnpm cache.
