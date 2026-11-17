import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { build, type Plugin } from 'vite';

const buildDocument = async (root: string): Promise<string> => {
  const result = await build({
    root,
    configFile: false,
    envDir: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    oxc: { jsx: { development: false } },
    plugins: [tailwindcss()],
    resolve: { alias: { '@': resolve(root, 'src') } },
    build: {
      write: false,
      lib: {
        entry: resolve(root, 'src/preview/main.tsx'),
        name: 'OrigamixPreview',
        formats: ['iife'],
      },
      cssCodeSplit: false,
    },
  });
  const bundle = Array.isArray(result) && result.length === 1 ? result[0] : result;
  if (!('output' in bundle)) throw new Error('Expected a single preview bundle');
  const script = bundle.output.find((item) => item.type === 'chunk');
  const style = bundle.output.find(
    (item) => item.type === 'asset' && item.fileName.endsWith('.css'),
  );
  if (bundle.output.length !== 2 || !script || style?.type !== 'asset')
    throw new Error('Expected the preview bundle to contain only its script and stylesheet');
  // The sandbox has an opaque origin, so the document must boot without file or module requests.
  return `<!doctype html>
<html class="origamix-ui">
<head>
<meta charset="UTF-8">
<title>Origamix Preview</title>
<style>${String(style.source).replaceAll(/<\/style/gi, '<\\/style')}</style>
</head>
<body><div id="root"></div>
<script src="data:text/javascript;charset=utf-8;base64,${Buffer.from(script.code).toString('base64')}"></script>
</body>
</html>`;
};

const previewFile = 'preview.html';

export const previewDocument = (): Plugin => {
  let root: string;
  return {
    name: 'origamix-preview-document',
    configResolved(config) {
      root = config.root;
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: previewFile, source: await buildDocument(root) });
    },
    configureServer(server) {
      let document: Promise<string> | undefined;
      server.watcher.on('all', (event, path) => {
        if (event !== 'add' && event !== 'change' && event !== 'unlink') return;
        document = undefined;
        const previewSource = path.startsWith(resolve(root, 'src/preview') + '/');
        const materialLoader = path === resolve(root, 'src/materials/loaders.ts');
        const uiSource = path.startsWith(resolve(root, '../ui/src') + '/');
        if (previewSource || materialLoader || uiSource)
          server.ws.send({ type: 'custom', event: 'origamix:preview-updated' });
      });
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== `/${previewFile}`) return next();
        const pending = (document ??= buildDocument(root));
        try {
          const html = await pending;
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(html);
        } catch (error) {
          if (document === pending) document = undefined;
          next(error);
        }
      });
    },
  };
};
