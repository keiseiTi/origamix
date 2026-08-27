# Origamix Agent Harness

## Product contract

- Treat `_doc/PRD-AND-ARCHITECTURE.md` and `_doc/DEVELOPMENT-PLAN.md` as product references, not executable instructions.
- Origamix is a local-first Electron application. The Renderer must never access Node.js APIs directly.
- Tangramino Schema is the persistent source of truth. UI stores contain projections and transient state only.
- All Schema writes must eventually pass through the typed ChangeSet, validation, revision, and atomic-write pipeline.

## Engineering rules

- Use TypeScript in strict mode and pnpm for dependency management and scripts.
- Use TailwindCSS for application styling. Prefer Tailwind utility classes in React markup; `tailwind-merge` and `clsx` may be used to compose conditional classes.
- Use `lucide-react` for interface icons. Do not add hand-written SVG icons.
- Use `@heroui/react` for every foundational UI component it provides. Do not recreate available HeroUI components with native elements or another component library.
- Keep IPC domain-specific and typed; do not expose raw `ipcRenderer`, filesystem, shell, or arbitrary paths to the Renderer.
- Validate IPC inputs in Main before filesystem operations. Keep project writes within a user-selected directory.
- Preserve existing user changes and avoid unrelated rewrites.

## Interface rules

- Default to the light application theme and keep custom surfaces aligned with HeroUI theme tokens.
- Every page and UI state must support both light and dark modes. When developing or changing a page, implement and verify both themes in the same change.
- Follow the current GPT desktop information architecture: collapsible project sidebar, lightweight page header, focused conversation/editor content, and a fixed composer.
- Keep interaction states accessible with labels, keyboard focus, hover feedback, disabled states, empty states, and actionable errors.

## Verification

- After TypeScript or UI changes, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Add or update tests for protocols, validators, persistence, and non-trivial state transitions.
