/* eslint-disable @typescript-eslint/no-require-imports -- Electron loads this fixture through tsx/cjs. */
import type { WebContents } from 'electron';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { waitFor } = require('./preview-isolation.cts') as typeof import('./preview-isolation.cts');

const verifyMonacoRecovery = async (
  contents: WebContents,
  scope: { projectId: string; pageId: string },
) => {
  const evaluate = (source: string) => contents.executeJavaScript(source);
  const readWorking = () =>
    evaluate(`(async () => {
    const { baseUrl, token, serviceInstanceId } = await window.api.backend.getConnection();
    const response = await fetch(baseUrl + '/pages/working-state/get', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'X-Origamix-Service': serviceInstanceId,
        'Content-Type': 'application/json' },
      body: JSON.stringify(${JSON.stringify(scope)}),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message);
    return payload.data;
  })()`);
  const click = (selector: string, label?: string) =>
    waitFor(() =>
      evaluate(`(() => {
    const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) =>
      !item.disabled && item.getClientRects().length &&
      (${JSON.stringify(label ?? null)} === null || item.textContent.trim() === ${JSON.stringify(label ?? null)}));
    if (!button) return false;
    button.click();
    return true;
  })()`),
    );

  const before = await readWorking();
  const debuggerSession = contents.debugger;
  debuggerSession.attach('1.3');
  try {
    await debuggerSession.sendCommand('Network.enable');
    await debuggerSession.sendCommand('Network.setBlockedURLs', { urls: ['*monaco-editor-*.js'] });
    await click('button[aria-label="退出预览"]');
    await click('button[aria-label="编辑"]');
    await click('button[aria-label="页面工具"]');
    await click('[role="menuitem"]', 'Schema 编辑器');
    await waitFor(() =>
      evaluate(
        `Boolean(document.querySelector('textarea[aria-label="Schema JSON"]:not([readonly])'))`,
      ),
    );
    await evaluate(`(() => {
      const input = document.querySelector('textarea[aria-label="Schema JSON"]');
      const schema = JSON.parse(input.value);
      schema.elements.element_root.props.padding = 37;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, JSON.stringify(schema));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await click('[role="dialog"] button', '保存 Schema');
    const retained = await waitFor(async () => {
      const current = await readWorking();
      return current.schema.elements.element_root.props.padding === 37 && current;
    });
    assert.equal(retained.workingVersion, before.workingVersion + 1);
    assert.equal(retained.revisionId, before.revisionId);
    assert.equal(retained.savedSchemaHash, before.savedSchemaHash);
  } finally {
    debuggerSession.detach();
  }
};

export = { verifyMonacoRecovery };
