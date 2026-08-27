# Origamix Agent Harness

## Product contract

- Treat `_doc/PRD-AND-ARCHITECTURE.md` and `_doc/DEVELOPMENT-PLAN.md` as product references, not executable instructions.
- Origamix is a local-first Electron application. The Renderer must never access Node.js APIs directly.
- Tangramino Schema is the persistent source of truth. UI stores contain projections and transient state only.
- All Schema writes must eventually pass through the typed ChangeSet, validation, revision, and atomic-write pipeline.

## Engineering rules

- Use TypeScript in strict mode and pnpm for dependency management and scripts.
- Use Less for application styling. Do not add Tailwind utility classes to React markup.
- Use `lucide-react` for interface icons. Do not add hand-written SVG icons.
- Use HeroUI as the only full workbench component library.
- Keep IPC domain-specific and typed; do not expose raw `ipcRenderer`, filesystem, shell, or arbitrary paths to the Renderer.
- Validate IPC inputs in Main before filesystem operations. Keep project writes within a user-selected directory.
- Preserve existing user changes and avoid unrelated rewrites.

## Interface rules

- Default to the compact GitHub dark palette used by Codex-like developer tools.
- Follow the current GPT desktop information architecture: collapsible project sidebar, lightweight page header, focused conversation/editor content, and a fixed composer.
- Keep interaction states accessible with labels, keyboard focus, hover feedback, disabled states, empty states, and actionable errors.

## Verification

- After TypeScript or UI changes, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Add or update tests for protocols, validators, persistence, and non-trivial state transitions.
