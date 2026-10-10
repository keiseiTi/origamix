# Site guidance

Read the root guide first. This package owns the local Rspress project website and Chinese documentation.

- Keep content in `docs/`, navigation in `_nav.json` / `_meta.json`, and theme customization in `theme/`.
- Ground capability and command descriptions in current package READMEs and implementation. Preserve the distinction between Working edits, explicit Revision saves and explicit Apply.
- This phase provides source acquisition and local startup, without installer downloads, screenshots or videos.
- Use Rspress's existing controls and public theme tokens; verify `html.rp-dark` as well as light mode.
- Run commands from the repository root: `pnpm --filter @origamix/site lint`, `pnpm --filter @origamix/site exec tsc --noEmit`, and `pnpm site:build`. Root gates remain required for TypeScript or UI changes.
- Verify navigation, search and representative pages in both themes and at narrow widths. Do not add automated presentation tests.
