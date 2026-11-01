# UI harness

Applies to `packages/ui/`. Read the [root guide](../../AGENTS.md) first.

- `src/components/` owns the single copy of repository shadcn/ui primitives; `src/lib/utils.ts` owns the public `cn` helper; `src/styles/styles.css` owns the palette and Tailwind foundations. No App compatibility copies or same-name wrappers.
- Consume components and `cn` only through `@origamix/ui`. The root barrel is the sole JavaScript entry; `styles.css` remains a separate opt-in entry. Internal imports stay relative to avoid barrel cycles.
- This private workspace package exports source for HMR and builds ESM/declarations for verification. It is not yet a published standalone distribution. When adding a control, update the root barrel without adding component subpath exports or build entries. Keep CSS marked as side effects and JavaScript free of initialization side effects.
- UI must not depend on Editor, App, Materials, Runtime, Shared, Server or Desktop. No business state, persistence or host capabilities. ESLint rejects direct imports of other workspace packages; this is not a complete dependency-graph sandbox.
- Preserve Base UI APIs, Tailwind, Lucide, accessibility and both themes. Internal imports are relative or declared self exports; never use the consumer's `@/` alias.
- Styles are opt-in: consumers import Tailwind once, then `@origamix/ui/styles.css`. The stylesheet scans its own components. Put `origamix-ui` on the consuming document's html element, plus `dark` for dark mode, so body portals inherit the palette. Do not add unscoped `:root`, body, window-layout or product state rules here.
- App owns product status colors, scrollbar, window layout and theme preference. Preview theme is explicitly delivered to its separate iframe document; generated pages do not import workbench styles.
- Both App and UI `components.json` route primitives to this package. Run the installed shadcn CLI from this package for shared primitives; normalize generated consumer imports to the root entry and internal imports to relative paths. Do not reinitialize App-local UI.
- Run `pnpm --filter @origamix/ui lint`, `typecheck`, `build` and the root gates. No component/composition tests for a behavior-preserving move; verify actual consuming interfaces in light and dark mode, including portals and focus restoration.
