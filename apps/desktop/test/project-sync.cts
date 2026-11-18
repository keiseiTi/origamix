/* eslint-disable @typescript-eslint/no-require-imports -- Electron loads this CommonJS fixture through tsx/cjs. */
import type { WebContents } from 'electron';
const { waitFor } = require('./preview-isolation.cts') as typeof import('./preview-isolation.cts');

const pickerFixture = `(async () => {
  const storage = await navigator.storage.getDirectory();
  const parent = await storage.getDirectoryHandle('sync-test-parent', { create: true });
  window.showDirectoryPicker = async () => parent;
  window.testSyncParent = parent;
})()`;

const verifyProjectSync = async (contents: WebContents, projectId: string) => {
  const evaluate = <T,>(script: string): Promise<T> => contents.executeJavaScript(script);
  const dialogButton = (name: string) =>
    waitFor(() =>
      evaluate(`(() => {
    const button = [...document.querySelectorAll('[role="dialog"] button')]
      .find((item) => item.textContent.trim() === ${JSON.stringify(name)} && !item.disabled);
    if (!button) return false;
    button.click();
    return true;
  })()`),
    );
  const text = (phrase: string) =>
    waitFor(() =>
      evaluate(
        `document.querySelector('[role="dialog"]')?.innerText.includes(${JSON.stringify(phrase)})`,
      ),
    );
  const openSync = async () => {
    await waitFor(() =>
      evaluate(`(() => {
      const target = document.querySelector('button[aria-label="Web MySQL integration 项目操作"]');
      if (!target) return false;
      target.click();
      return true;
    })()`),
    );
    await waitFor(() =>
      evaluate(`(() => {
      const entry = [...document.querySelectorAll('[role="menuitem"]')]
        .find((item) => item.textContent.trim() === '同步到本地');
      if (!entry) return false;
      entry.click();
      return true;
    })()`),
    );
  };

  await evaluate(pickerFixture);
  await openSync();
  await dialogButton('选择父目录');
  await text('sync-test-parent');
  await evaluate(`(() => {
    const original = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = function (...args) {
      if (this.name === 'schema.json') {
        FileSystemFileHandle.prototype.createWritable = original;
        throw new Error('测试：写入中断');
      }
      return original.apply(this, args);
    };
  })()`);
  await dialogButton('同步到本地');
  await text('测试：写入中断');

  // Reload restores the real IndexedDB handle and resumes the server-side pending snapshot.
  await contents.loadURL(contents.getURL());
  await evaluate(pickerFixture);
  await openSync();
  await text('sync-test-parent');
  await dialogButton('同步到本地');
  await text('已同步到本地');

  await evaluate(`(async () => {
    const send = async (path, body) => {
      const response = await fetch('/api/v1' + path, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!payload.success) throw Error(payload.message);
      return payload.data;
    };
    const projectId = ${JSON.stringify(projectId)};
    const { code } = await send('/projects/sync/identity', { projectId });
    const root = await window.testSyncParent.getDirectoryHandle(code);
    const text = async (location, name) => (await (await location.getFileHandle(name)).getFile()).text();
    const write = async (location, name, value) => {
      const stream = await (await location.getFileHandle(name, { create: true })).createWritable();
      await stream.write(value);
      await stream.close();
    };
    const manifest = JSON.parse(await text(root, 'origamix.project.json'));
    if (manifest.projectId !== projectId || JSON.parse(await text(root, 'package.json')).name !== code)
      throw Error('Project template or identity missing');
    const pages = await (await root.getDirectoryHandle('src')).getDirectoryHandle('pages');
    const home = await pages.getDirectoryHandle('home');
    const schema = await text(home, 'schema.json');
    if (!schema.includes('preview_button') || !(await text(home, 'index.tsx')).includes('schema.json'))
      throw Error('Saved schema or generated page entry missing');
    await write(home, 'notes.txt', 'user-owned');
    await write(home, 'schema.json', 'local edit');
    const pageId = manifest.pages.find(({ slug }) => slug === 'home').pageId;
    window.syncFixture = { send, root, home, write, text, schema, projectId, pageId };
  })()`);

  await dialogButton('同步到本地');
  await text('本地文件已变化：src/pages/home/schema.json');
  await evaluate(`(async () => {
    const { send, home, text, projectId, pageId } = window.syncFixture;
    if (await text(home, 'schema.json') !== 'local edit') throw Error('Conflict overwrote local work');
    const working = await send('/pages/working-state/get', { projectId, pageId });
    const edited = await send('/pages/working-operations/apply', {
      projectId, pageId, baseWorkingVersion: working.workingVersion,
      operations: [{ operation: 'updateElementProps', elementId: 'element_root', set: {height: 123} }],
    });
    if (edited.workingVersion !== working.workingVersion + 1) throw Error('A sync conflict blocked editing');
    const { write, schema } = window.syncFixture;
    await write(home, 'schema.json', schema);
  })()`);
  await dialogButton('同步到本地');
  await text('已同步到本地');
  await evaluate(`(async () => {
    const { send, projectId, pageId } = window.syncFixture;
    await send('/pages/delete', { projectId, pageId, scope: 'desktop_record' });
  })()`);
  // The current editor retained the deleted page; reload as an ordinary client after this
  // test-only API deletion to obtain the new page inventory before syncing.
  await evaluate("localStorage.setItem('origamix:theme', 'light')");
  await contents.loadURL(contents.getURL());
  await evaluate(pickerFixture);
  await openSync();
  await text('sync-test-parent');
  await dialogButton('同步到本地');
  await text('已同步到本地');
  await evaluate(`(async () => {
    const response = await fetch('/api/v1/projects/sync/identity', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ projectId: ${JSON.stringify(projectId)} }),
    });
    const { data: { code } } = await response.json();
    const root = await window.testSyncParent.getDirectoryHandle(code);
    const manifest = JSON.parse(await (await (await root.getFileHandle('origamix.project.json')).getFile()).text());
    const home = await (await (await root.getDirectoryHandle('src')).getDirectoryHandle('pages')).getDirectoryHandle('home');
    if (manifest.pages.some(({ slug }) => slug === 'home')) throw Error('Deleted page remains in project manifest');
    for (const name of ['index.tsx', 'schema.json']) {
      try {
        await home.getFileHandle(name);
        throw Error('Managed file still exists: ' + name);
      } catch (error) {
        if (error.name !== 'NotFoundError') throw error;
      }
    }
    if (await (await (await home.getFileHandle('notes.txt')).getFile()).text() !== 'user-owned')
      throw Error('User file was not preserved');
  })()`);
  await waitFor(() => evaluate("document.documentElement.dataset.theme === 'light'"));
  await evaluate(`(() => {
    const objectUrl = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      window.exportedSyncZip = blob.arrayBuffer();
      return objectUrl.call(this, blob);
    };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (!this.href.startsWith('blob:')) return click.call(this);
    };
  })()`);
  await dialogButton('下载项目 ZIP');
  await text('项目 ZIP 已开始下载');
  await evaluate(`(async () => {
    const archive = new Uint8Array(await window.exportedSyncZip);
    const entries = new TextDecoder().decode(archive);
    if (archive[0] !== 80 || archive[1] !== 75 || !entries.includes('origamix.project.json') ||
        !entries.includes('src/pages/editing/schema.json') || entries.includes('src/pages/home/schema.json'))
      throw Error('ZIP export did not use the current project snapshot');
  })()`);
  await dialogButton('关闭');
};

export = { verifyProjectSync };
