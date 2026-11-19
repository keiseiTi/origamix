/* eslint-disable @typescript-eslint/no-require-imports -- Electron loads this fixture through tsx/cjs. */
import type { WebContents } from 'electron';
const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
const { waitFor } = require('./preview-isolation.cts') as typeof import('./preview-isolation.cts');

const verifyProjectExport = async (
  contents: WebContents,
  projectId: string,
  archive: string,
  name: string,
) => {
  const click = (selector: string, label: string) =>
    waitFor(() =>
      contents.executeJavaScript(`(() => {
        const item = [...document.querySelectorAll(${JSON.stringify(selector)})]
          .find((element) => element.textContent.trim() === ${JSON.stringify(label)} && !element.disabled);
        if (!item) return false;
        item.click();
        return true;
      })()`),
    );
  await waitFor(() =>
    contents.executeJavaScript(`(() => {
      const label = ${JSON.stringify(name + ' 项目操作')};
      const button = [...document.querySelectorAll('button')].find((item) => item.getAttribute('aria-label') === label);
      if (!button) return false;
      button.click();
      return true;
    })()`),
  );
  await click('[role="menuitem"]', '导出项目 ZIP');
  const downloaded = new Promise<void>((resolve, reject) => {
    contents.session.once('will-download', (_event, item) => {
      item.setSavePath(archive);
      item.once('done', (_event, state) => {
        if (state === 'completed') resolve();
        else reject(new Error(`Project ZIP download ${state}`));
      });
    });
  });
  await click('[role="dialog"] button', '下载 ZIP');
  await downloaded;
  const read = (path: string) => execFileSync('unzip', ['-p', archive, path], { encoding: 'utf8' });
  const manifest = JSON.parse(read('origamix.project.json'));
  if (manifest.projectId !== projectId || Object.hasOwn(manifest, 'product'))
    throw new Error('ZIP did not preserve the host-neutral project identity');
  if (!read('src/pages/home/schema.json').includes('preview_button'))
    throw new Error('ZIP did not include the saved preview page');
};

export = { verifyProjectExport };
