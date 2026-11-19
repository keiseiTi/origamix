import type { WebContents } from 'electron';

const waitFor = async <T,>(check: () => T | Promise<T>) => {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Window did not reach the expected state');
};

// Runs in the trusted test workbench. The expression changes only the test button label.
const seedPreviewPage = async (
  request: (path: string, body: object) => Promise<{ id: string; workingVersion: number }>,
  projectId: string,
  apiUrl: string,
  existingPageId?: string,
): Promise<void> => {
  const pageId =
    existingPageId ??
    (
      await request('/pages/create', {
        projectId,
        name: 'Home',
        slug: 'home',
      })
    ).id;
  const working = await request('/pages/working-state/get', { projectId, pageId });
  const accessCheck = `(async () => {
      const requestBlocked = await fetch(${JSON.stringify(apiUrl + '/projects/list')}, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
      }).then(response => !response.ok, () => true);
      const blocked = (read) => {
        try { return !read(); } catch { return true; }
      };
      return blocked(() => parent.document) &&
        blocked(() => parent.sessionStorage) &&
        blocked(() => parent.localStorage) &&
        blocked(() => parent.api?.backend) &&
        !window.api && self.origin === 'null' && requestBlocked
        ? "Preview isolated " + document.documentElement.dataset.theme
        : "Preview isolation failed";
    })()`;
  await request('/pages/working-operations/apply', {
    projectId,
    pageId,
    baseWorkingVersion: working.workingVersion,
    operations: [
      {
        operation: 'addElement',
        elementId: 'preview_button',
        parentId: 'element_root',
        element: { type: 'button', props: { text: 'Run preview check' } },
      },
      {
        operation: 'addFlow',
        flowId: 'flow_preview_check',
        flow: {
          startId: 'start',
          nodes: {
            start: { id: 'start', type: 'start', props: {}, prev: [], next: ['inspect'] },
            inspect: {
              id: 'inspect',
              type: 'setElementProps',
              prev: ['start'],
              next: [],
              props: {
                setters: [
                  {
                    elementId: 'preview_button',
                    propName: 'text',
                    value: {
                      type: 'expression',
                      value: accessCheck,
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        operation: 'setElementEventBinding',
        elementId: 'preview_button',
        event: 'onClick',
        flowId: 'flow_preview_check',
      },
    ],
  });
};

const verifyPreview = async (contents: WebContents, pageName = 'Home'): Promise<void> => {
  await waitFor(() =>
    contents.executeJavaScript(`(() => {
      const page = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === ${JSON.stringify(pageName)});
      if (!page) return false;
      page.click();
      return true;
    })()`),
  );
  await waitFor(() =>
    contents.executeJavaScript(`Boolean(document.querySelector('button[aria-label="预览"]'))`),
  );
  await contents.executeJavaScript(`document.querySelector('button[aria-label="预览"]')?.click()`);
  const preview = await waitFor(() =>
    contents.mainFrame.frames.find(
      (frame) => frame.url && new URL(frame.url).pathname.endsWith('/preview.html'),
    ),
  );
  const checkTheme = async (theme: 'light' | 'dark') => {
    await waitFor(() =>
      preview.executeJavaScript(`document.documentElement?.dataset.theme === ${JSON.stringify(theme)} &&
        Boolean(document.querySelector('button'))`),
    );
    await preview.executeJavaScript('document.querySelector("button").click()');
    await waitFor(() =>
      preview.executeJavaScript(
        `document.body.innerText.includes(${JSON.stringify('Preview isolated ' + theme)})`,
      ),
    );
  };
  try {
    await checkTheme('light');
    await contents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown', {
      code: 'Comma', metaKey: true, ctrlKey: true,
    })); void 0;`);
    await waitFor(() =>
      contents.executeJavaScript(`(() => {
        const option = [...document.querySelectorAll('label')].find((label) => label.innerText.includes('深色'));
        if (!option) return false;
        option.querySelector('[role="radio"]')?.click();
        document.querySelector('[aria-label="关闭设置"]')?.click();
        return true;
      })()`),
    );
    await checkTheme('dark');
  } catch (error) {
    const state = await preview.executeJavaScript(`JSON.stringify({
      text: document.body.innerText.slice(0, 300),
      mounted: Boolean(document.querySelector('#root')?.childElementCount),
      script: Boolean(document.querySelector('script[src^="data:"]')),
      theme: document.documentElement.dataset.theme,
    })`);
    const errorText = await contents.executeJavaScript(
      `document.querySelector('[role="alert"]')?.textContent ?? ''`,
    );
    throw new Error(
      `Preview check did not finish. Frame: ${state}. Workbench error: ${errorText}`,
      { cause: error },
    );
  }
  const blocked = await contents.executeJavaScript(
    `[...document.querySelectorAll('iframe')].find(
      (frame) => frame.title === ${JSON.stringify(pageName + ' 预览')},
    )?.contentDocument === null`,
  );
  if (!blocked) throw new Error('The workbench can read the preview document');
};

export = { waitFor, seedPreviewPage, verifyPreview };
