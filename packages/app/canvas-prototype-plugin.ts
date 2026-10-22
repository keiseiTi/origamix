import { build, type Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

/** One inline, offline frame artifact works for both HTTP dev and Electron file: documents. */
export const canvasPrototype = (): Plugin => {
  let document: Promise<string> | undefined;
  const compile = async (): Promise<string> => {
    const output = await build({
      configFile: false,
      mode: 'production',
      resolve: { conditions: ['browser', 'production'] },
      root: fileURLToPath(new URL('.', import.meta.url)),
      plugins: [tailwindcss()],
      oxc: { jsx: { runtime: 'automatic', development: false } },
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      logLevel: 'warn',
      build: {
        write: false,
        minify: true,
        lib: {
          entry: fileURLToPath(new URL('./src/canvas-prototype/frame.tsx', import.meta.url)),
          name: 'OrigamixCanvasPrototype',
          formats: ['iife'],
        },
        // Tangramino definePlugin is an identity factory. Remove unused collaboration
        // exports and their eager WASM startup; this frame never installs collaboration.
        rolldownOptions: {
          treeshake: {
            manualPureFunctions: ['definePlugin'],
            moduleSideEffects: (id) => !id.includes('/loro-crdt/'),
          },
        },
        cssCodeSplit: false,
      },
    });
    const results = Array.isArray(output) ? output : [output];
    let script = '',
      css = '';
    for (const result of results)
      if ('output' in result)
        for (const item of result.output) {
          if (item.type === 'chunk') script += item.code;
          else if (item.fileName.endsWith('.css')) css += String(item.source);
        }
    if (!script) throw new Error('Canvas prototype bundle was not produced');
    return `<!doctype html><html class="origamix-ui"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-__CANVAS_NONCE__'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><style>${css.replaceAll('</style', '<\\/style')}</style></head><body><div id="root"></div><script nonce="__CANVAS_NONCE__">${script.replaceAll('</script', '<\\/script')}</script></body></html>`;
  };
  return {
    name: 'origamix-canvas-prototype',
    handleHotUpdate(context) {
      if (
        !/\/(canvas-prototype\/(frame\.tsx|frame\.css|protocol\.ts)|editor\/src\/|materials\/dist\/)/.test(
          context.file,
        )
      )
        return;
      document = undefined;
      const module = context.server.moduleGraph.getModuleById('\0canvas-prototype-document');
      if (module) context.server.moduleGraph.invalidateModule(module);
      context.server.ws.send({ type: 'full-reload' });
      return [];
    },
    resolveId: (id) =>
      id === 'virtual:canvas-prototype-document' ? '\0canvas-prototype-document' : undefined,
    async load(id) {
      if (id !== '\0canvas-prototype-document') return;
      document ??= compile().catch((error: unknown) => {
        document = undefined;
        throw error;
      });
      return `export default ${JSON.stringify(await document)}`;
    },
  };
};
