import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { stopChild } from '@origamix/server/development';

// Native integration: ordered rebuilds must restart the host with matching backend/template artifacts.
const original = fileURLToPath(new URL('../../../', import.meta.url));
const root = await mkdtemp(join(tmpdir(), 'origamix-desktop-dev-'));
let child;
let output = '';
let socket;
let serial = 0;
let requests = new Map();
const waitFor = async (check, timeout = 120000) => {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    if (child?.exitCode != null) throw new Error(output.slice(-6000));
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  let detail;
  try {
    detail = await evaluate(`document.body.innerText.slice(0, 3000)`);
  } catch {
    /* window closed */
  }
  throw new Error(
    `Desktop development check timed out: ${detail}; ${lastError?.message}\n${output.slice(-8000)}`,
  );
};
const connect = async () => {
  socket?.close();
  const targets = await (await fetch('http://127.0.0.1:9236/json/list')).json();
  const page = targets.find(
    (target) => target.type === 'page' && target.url.startsWith('http://127.0.0.1:5196'),
  );
  if (!page) return false;
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  requests = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const request = requests.get(message.id);
    if (request) {
      requests.delete(message.id);
      clearTimeout(request.timer);
      request.resolve(message);
    }
  });
  return true;
};
const evaluate = async (expression) => {
  const id = ++serial;
  const response = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      requests.delete(id);
      reject(new Error('CDP request interrupted'));
    }, 5000);
    requests.set(id, { resolve, timer });
    socket.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true },
      }),
    );
  });
  if (response.result?.exceptionDetails || response.error)
    throw new Error(
      response.result?.exceptionDetails?.exception?.description ??
        response.result?.exceptionDetails?.text ??
        response.error?.message ??
        'Page evaluation failed',
    );
  return response.result.result.value;
};
const connection = () =>
  evaluate(
    `window.api.backend.getConnection().then(({baseUrl,serviceInstanceId})=>({baseUrl,serviceInstanceId}))`,
  );
try {
  await symlink(join(original, 'node_modules'), join(root, 'node_modules'), 'junction');
  for (const name of ['package.json', 'pnpm-workspace.yaml', 'tsconfig.base.json'])
    await cp(join(original, name), join(root, name));
  for (const name of [
    'app',
    'server',
    'shared',
    'runtime',
    'materials',
    'editor',
    'ui',
    'template',
  ]) {
    const source = join(original, 'packages', name);
    await cp(source, join(root, 'packages', name), {
      recursive: true,
      verbatimSymlinks: true,
      filter: (file) =>
        !relative(source, file)
          .split(sep)
          .some((part) => ['.env.local', '.vite', '.origamix-web', 'dist'].includes(part)),
    });
  }
  const desktop = join(root, 'apps/desktop');
  await cp(join(original, 'apps/desktop'), desktop, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (file) =>
      !relative(join(original, 'apps/desktop'), file)
        .split(sep)
        .some((part) => ['dist', '.env.local'].includes(part)),
  });
  // Isolate the real Electron app without adding test/development hooks to product Main.
  const manifestPath = join(desktop, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.main = 'test-development.cjs';
  await writeFile(manifestPath, JSON.stringify(manifest));
  await writeFile(
    join(desktop, manifest.main),
    `require('electron').app.setPath('userData', ${JSON.stringify(join(root, 'user-data'))});require('./dist/main/index.cjs');`,
  );
  const launch = () => {
    child = fork(join(desktop, 'scripts/dev.mjs'), [], {
      cwd: root,
      env: {
        ...process.env,
        ORIGAMIX_ENV_LOCAL: '0',
        ORIGAMIX_RENDERER_PORT: '5196',
        ORIGAMIX_DEBUG: '1',
        ORIGAMIX_DEBUG_PORT: '9236',
        ORIGAMIX_INSPECT_PORT: '9237',
      },
      silent: true,
    });
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stderr.on('data', (data) => {
      output += data;
    });
  };
  launch();
  await waitFor(() => output.includes('桌面已启动'));
  await waitFor(connect);
  await waitFor(() => connection());
  await waitFor(() =>
    evaluate(
      `import('/src/store/workspace.ts').then(({useWorkspaceStore:s})=>s.getState().workspaceReady)`,
    ),
  );
  assert.equal(await evaluate('window.api.development === undefined'), true);
  const first = await connection();
  const templateBefore = await readFile(join(desktop, 'dist/template/README.md'), 'utf8');
  for (const name of ['shared', 'runtime', 'server']) {
    const source = join(
      root,
      'packages',
      name,
      name === 'server' ? 'src/errors.ts' : 'src/index.ts',
    );
    await writeFile(source, (await readFile(source, 'utf8')) + '\n// development-source-update\n');
  }
  // Resource preparation must load the newly compiled template copier, not a cached module.
  const copierSource = join(root, 'packages/server/src/templates/copy-template.ts');
  const copier = (await readFile(copierSource, 'utf8'))
    .replace('cp, lstat', 'cp, lstat, writeFile')
    .replace(
      '  });\n};',
      "  });\n  await writeFile(target + '/development-copy-proof', 'fresh copier');\n};",
    );
  await writeFile(copierSource, copier);
  const mainSource = join(desktop, 'src/main/index.ts');
  await writeFile(
    mainSource,
    (await readFile(mainSource, 'utf8')) + "\nconsole.info('Development Main refreshed');\n",
  );
  const templateSource = join(root, 'packages/template/README.md');
  await writeFile(templateSource, templateBefore + '\nDevelopment template refreshed.\n');
  const materialSource = join(root, 'packages/materials/antd/button/manifest.ts');
  await writeFile(
    materialSource,
    (await readFile(materialSource, 'utf8')).replace(
      "title: '按钮'",
      "title: 'Development button'",
    ),
  );
  await waitFor(() => output.includes('桌面已自动重启'));
  await waitFor(connect);
  await waitFor(() => connection());
  const second = await connection();
  assert.equal(
    await readFile(join(desktop, 'dist/template/development-copy-proof'), 'utf8'),
    'fresh copier',
  );
  assert.notEqual(second.serviceInstanceId, first.serviceInstanceId);
  assert.ok(output.includes('Development Main refreshed'));
  assert.match(await readFile(join(desktop, 'dist/main/server.cjs'), 'utf8'), /Development button/);
  assert.match(
    await readFile(join(desktop, 'dist/template/README.md'), 'utf8'),
    /Development template refreshed/,
  );
  if (first.baseUrl !== second.baseUrl) await assert.rejects(fetch(`${first.baseUrl}/health`));
  child.stdin.write('p\n');
  await waitFor(() => output.includes('自动重启已暂停'));
  const currentMain = await readFile(mainSource, 'utf8');
  await writeFile(mainSource, currentMain + '\n// paused update\n');
  await waitFor(() => output.includes('输入 p 并回车恢复'));
  assert.equal((await connection()).serviceInstanceId, second.serviceInstanceId);
  child.stdin.write('p\n');
  await waitFor(() => (output.match(/桌面已自动重启/g)?.length ?? 0) >= 2);
  await waitFor(connect);
  const third = await waitFor(() => connection());
  assert.notEqual(third.serviceInstanceId, second.serviceInstanceId);
  const beforeFailure = output.length;
  await writeFile(mainSource, currentMain + '\nconst = invalid;\n');
  await waitFor(() => output.slice(beforeFailure).includes('更新暂停'));
  assert.equal((await connection()).serviceInstanceId, third.serviceInstanceId);
  await writeFile(mainSource, currentMain);
  await waitFor(() => (output.match(/桌面已自动重启/g)?.length ?? 0) >= 3);
  await waitFor(connect);
  assert.notEqual((await waitFor(() => connection())).serviceInstanceId, third.serviceInstanceId);
  console.info(
    'Desktop development passed: ordered dependency builds, automatic restart loads Main/backend/template updates and a fresh connection.',
  );
} finally {
  socket?.close();
  await stopChild(child);
  await rm(root, { recursive: true, force: true });
}
