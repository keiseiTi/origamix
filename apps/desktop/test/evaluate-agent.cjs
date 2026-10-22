const { app, BrowserWindow, dialog, utilityProcess } = require('electron');
const {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { createHash, randomUUID } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const allCases = require('./agent-quality-cases.cjs');

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const root = resolve(__dirname, '../../..');
const output = resolve(
  argument('--output') ??
    join(
      root,
      '_doc/verification/reports',
      `agent-quality-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    ),
);
mkdirSync(output, { recursive: true });
const selected = argument('--case');
const cases = selected ? allCases.filter((item) => item.id === selected) : allCases;
assert.ok(cases.length, 'Unknown quality case');
const report = {
  version: '1',
  suiteVersion: 'page-quality-7',
  kind: 'origamix-live-page-quality',
  startedAt: new Date().toISOString(),
  status: 'running',
  automatedPassed: false,
  modelQualityAccepted: false,
  visualReview: 'pending',
  evidence: {
    model: 'live-provider',
    host: 'real-electron-main',
    projects: 'isolated-temporary',
    credential: 'existing-encrypted-desktop-settings',
    firstModelEventMs: null,
    metricLimit:
      'Token counts are persisted Agent metrics, not billing totals; modelCalls counts executor invocations, not every provider turn. Failed calls may have unreported usage.',
    securityAudit: 'not-performed',
  },
  cases: [],
};
try {
  report.commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  report.workingTreeDirty = Boolean(
    execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
  );
} catch {
  report.commit = null;
}
const writeReport = () =>
  writeFileSync(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeReport();

const state =
  process.env.ORIGAMIX_QUALITY_STATE_DIR ?? mkdtempSync(join(tmpdir(), 'origamix-live-quality-'));
const projects = join(state, 'projects');
mkdirSync(projects);
const manifest = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));
app.setName(manifest.name);
const settingsPath =
  argument('--settings') ?? join(app.getPath('appData'), manifest.name, 'model-settings.json');
app.setPath('userData', state);
delete process.env.ELECTRON_RENDERER_URL;
delete process.env.ORIGAMIX_TEMPLATE_DIR;
let main;
let currentBackend;
let previewServer;
const commandChildren = new Set();
let finishing = false;
const ownedWindows = [];
const timer = setTimeout(() => void finish(new Error('SUITE_TIMEOUT')), 15 * 60_000);

// Plaintext credentials remain inside the existing Main -> Utility Process path.
// Copy only the encrypted settings into disposable state, never into the report/project.
try {
  assert.ok(existsSync(settingsPath), 'MODEL_SETTINGS_MISSING');
  copyFileSync(settingsPath, join(state, 'model-settings.json'));
  chmodSync(join(state, 'model-settings.json'), 0o600);
  const settings = JSON.parse(readFileSync(join(state, 'model-settings.json'), 'utf8'));
  assert.ok(settings.encryptedApiKey, 'MODEL_CREDENTIAL_MISSING');
  const model = argument('--model');
  if (model) {
    assert.ok(['deepseek-flash', 'deepseek-v4-pro'].includes(model), 'MODEL_UNSUPPORTED');
    settings.model = model;
    writeFileSync(join(state, 'model-settings.json'), JSON.stringify(settings), { mode: 0o600 });
  }
} catch (error) {
  report.status = 'blocked';
  report.blocker = error.code === 'ENOENT' ? 'MODEL_SETTINGS_MISSING' : error.message;
  report.finishedAt = new Date().toISOString();
  writeReport();
  rmSync(state, { recursive: true, force: true });
  console.error(`Live evaluation blocked: ${report.blocker}. Report: ${output}`);
  app.exit(2);
}

const waitFor = async (check, timeout = 20_000, failureCode = 'CHECK_TIMEOUT') => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(failureCode);
};
const evaluate = (code) => main.webContents.executeJavaScript(code);
const capture = async (contents, filename) => {
  await contents.executeJavaScript(
    'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
  );
  await new Promise((resolve) => setTimeout(resolve, 200));
  writeFileSync(join(output, filename), (await contents.capturePage()).toPNG());
};
const request = (path, body = {}) =>
  evaluate(`(async () => {
  const connection = await window.api.backend.getConnection();
  const response = await fetch(connection.baseUrl + ${JSON.stringify(path)}, {
    method: 'POST', headers: { Authorization: 'Bearer ' + connection.token,
      'X-Origamix-Service': connection.serviceInstanceId, 'Content-Type': 'application/json' },
    body: JSON.stringify(${JSON.stringify(body)})
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error('HTTP_' + response.status);
  return result.data;
})()`);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const snapshot = (path) => readFileSync(path, 'utf8');
const saveWorkingEvidence = (record, working) => {
  record.workingSnapshot = `${record.caseId}-working.json`;
  writeFileSync(join(output, record.workingSnapshot), `${JSON.stringify(working, null, 2)}\n`);
};
const signalChild = (child, signal = 'SIGTERM') => {
  if (!child?.pid || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
};
const metricsFor = (runId) => {
  const database = new DatabaseSync(join(state, 'origamix.db'), { readOnly: true });
  try {
    const metrics = database
      .prepare(
        `SELECT model_ref AS modelRef, prompt_version AS promptVersion,
      toolset_version AS toolsetVersion, material_manifest_version AS materialManifestVersion,
      input_tokens AS inputTokens, output_tokens AS outputTokens, model_calls AS executorCalls,
      tool_calls AS toolCalls, duration_ms AS durationMs, repair_attempts AS repairAttempts,
      error_code AS errorCode, failure_stage AS failureStage
      FROM agent_runs WHERE run_id = ?`,
      )
      .get(runId);
    const tools = database
      .prepare(
        `SELECT tool_name AS toolName, phase, safe_error_code AS errorCode,
      duration_ms AS durationMs FROM agent_tool_audits
      WHERE run_id = (SELECT id FROM agent_runs WHERE run_id = ?) ORDER BY sequence`,
      )
      .all(runId);
    return { ...metrics, tools };
  } finally {
    database.close();
  }
};
const runAgent = async (scope, prompt, record, conversationId) => {
  const before = await request('/pages/working-state/get', scope);
  const startedAt = Date.now();
  const started = await request('/agent/runs/create', {
    version: '1',
    ...scope,
    baseWorkingVersion: before.workingVersion,
    clientRequestId: randomUUID(),
    ...(conversationId ? { conversationId } : {}),
    content: { version: '1', blocks: [{ type: 'text', text: prompt }] },
  });
  record.runIds.push(started.runId);
  writeReport();
  let run;
  try {
    run = await waitFor(async () => {
      const result = (
        await request('/agent/runs/get', { projectId: scope.projectId, runId: started.runId })
      ).run;
      return ['completed', 'failed', 'cancelled', 'interrupted'].includes(result.status) && result;
    }, 180_000);
  } catch (error) {
    // Cancellation preserves the original Run identity; no retry or mutation replay.
    await request('/agent/runs/cancel', {
      projectId: scope.projectId,
      runId: started.runId,
      requestId: randomUUID(),
    });
    throw error;
  }
  const metrics = metricsFor(started.runId);
  record.runs.push({
    runId: started.runId,
    status: run.status,
    outcome: run.outcome,
    baseWorkingVersion: run.baseWorkingVersion,
    resultWorkingVersion: run.resultWorkingVersion,
    wallDurationMs: Date.now() - startedAt,
    ...metrics,
  });
  writeReport();
  assert.equal(run.status, 'completed', `AGENT_${metrics.errorCode ?? run.status}`);
  assert.ok(
    ['changed', 'changed_and_answered'].includes(run.outcome),
    `AGENT_OUTCOME_${run.outcome}`,
  );
  const after = await request('/pages/working-state/get', scope);
  assert.equal(after.workingVersion, before.workingVersion + 1, 'WORKING_COMMIT_COUNT');
  assert.equal(after.revisionId, before.revisionId, 'AGENT_CREATED_REVISION');
  return { working: after, conversationId: started.conversationId };
};

const exercise = async (contents, documentExpression, item, button) => {
  const requirements = { visible: item.visible, placeholders: item.placeholders };
  await waitFor(() =>
    contents.executeJavaScript(`(() => {
    const doc = ${documentExpression};
    const requirements = ${JSON.stringify(requirements)};
    return Boolean(doc && requirements.visible.every(text => doc.body.innerText.includes(text)) &&
      requirements.placeholders.every(text => [...doc.querySelectorAll('input')].some(input => input.placeholder === text)) &&
      [...doc.querySelectorAll('button')].some(node => node.textContent.trim() === ${JSON.stringify(button)}));
  })()`),
  );
  const action = await contents.executeJavaScript(`(() => {
    const doc = ${documentExpression};
    const target = [...doc.querySelectorAll('button')].find(node => node.textContent.trim() === ${JSON.stringify(button)});
    const initialRect = target.getBoundingClientRect();
    // Match a normal browser click: reveal controls in legitimate scroll containers first.
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const rect = target.getBoundingClientRect();
    const hit = doc.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    if (rect.width <= 0 || rect.height <= 0 || target.disabled || !hit || !target.contains(hit))
      return { ok: false, code: 'ACTION_NOT_VISIBLE_OR_CLICKABLE',
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        hitTag: hit?.tagName ?? null };
    target.click();
    return { ok: true, scrolled: initialRect.x !== rect.x || initialRect.y !== rect.y,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
  })()`);
  if (!action.ok) {
    const error = new Error(action.code);
    error.renderEvidence = action;
    throw error;
  }
  await waitFor(() =>
    contents.executeJavaScript(
      `(${documentExpression})?.body.innerText.includes(${JSON.stringify(item.afterClick)})`,
    ),
  );
  return action;
};
const checkPreview = async (item, record, button) => {
  for (const theme of ['light', 'dark']) {
    await evaluate(`localStorage.setItem('origamix:theme', ${JSON.stringify(theme)})`);
    main.reload();
    await waitFor(
      () =>
        !main.webContents.isLoading() &&
        evaluate(`document.body.innerText.includes(${JSON.stringify(item.name)})`),
    );
    await evaluate(
      `[...document.querySelectorAll('button')].find(button => button.textContent.trim() === ${JSON.stringify(item.name)})?.click()`,
    );
    const previewButton = `[...document.querySelectorAll('button[aria-label="预览"]')].find(button => !button.disabled && !button.closest('[inert]') && getComputedStyle(button).visibility === 'visible' && button.getBoundingClientRect().width > 0 && button.getBoundingClientRect().height > 0)`;
    await waitFor(() => evaluate(`Boolean(${previewButton})`));
    await evaluate(`(${previewButton}).click()`);
    const frameElement = `document.querySelector('iframe[title=${JSON.stringify(`${item.name} 预览`)}]')`;
    const frame = `${frameElement}?.contentDocument`;
    const filename = `${item.id}-preview-${theme}.png`;
    let passed = false;
    let interaction;
    try {
      await waitFor(
        () =>
          evaluate(`(() => {
        const frame = ${frameElement};
        return Boolean(frame && !frame.closest('[inert]') && getComputedStyle(frame).visibility === 'visible' && frame.getBoundingClientRect().width > 0 && frame.getBoundingClientRect().height > 0);
      })()`),
        20_000,
        'PREVIEW_NOT_VISIBLE',
      );
      interaction = await exercise(main.webContents, frame, item, button);
      assert.equal(
        await evaluate(`typeof (${frame})?.defaultView?.api`),
        'undefined',
        'PREVIEW_HAS_BRIDGE',
      );
      passed = true;
    } finally {
      await capture(main.webContents, filename);
      record.checks.push({
        id: `preview-${theme}`,
        passed,
        screenshot: filename,
        ...(interaction ? { interaction } : {}),
      });
      writeReport();
    }
  }
};

const command = (args, cwd) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
      cwd,
      stdio: 'ignore',
      detached: process.platform !== 'win32',
    });
    commandChildren.add(child);
    const timeout = setTimeout(() => signalChild(child, 'SIGKILL'), 120_000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      commandChildren.delete(child);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      commandChildren.delete(child);
      if (code === 0) resolvePromise();
      else reject(new Error(`STANDALONE_${args[0].toUpperCase()}_FAILED`));
    });
  });
const finish = async (error) => {
  if (finishing) return;
  finishing = true;
  clearTimeout(timer);
  signalChild(previewServer);
  commandChildren.forEach((child) => signalChild(child, 'SIGKILL'));
  ownedWindows.forEach((window) => {
    if (!window.isDestroyed()) window.destroy();
  });
  if (error) {
    report.status = 'failed';
    report.failure = error.message;
  }
  if (error && report.standalone?.status === 'running') report.standalone.status = 'failed';
  report.finishedAt = new Date().toISOString();
  report.automatedPassed =
    !error && report.cases.length === cases.length && report.cases.every((item) => item.passed);
  if (!error) report.status = report.automatedPassed ? 'awaiting-visual-review' : 'failed';
  writeReport();
  // Credentials and database are temporary. Only synthetic generated project artifacts are retained.
  rmSync(join(state, 'model-settings.json'), { force: true });
  console.info(`Live Agent evaluation: ${report.status}. Evidence: ${output}`);
  process.exitCode = report.automatedPassed ? 0 : 1;
  app.quit();
};
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [projects] });
dialog.showErrorBox = () => void finish(new Error('DESKTOP_STARTUP_FAILED'));
const fork = utilityProcess.fork.bind(utilityProcess);
utilityProcess.fork = (...args) => {
  currentBackend = fork(...args);
  return currentBackend;
};
process.once('SIGTERM', () => void finish(new Error('EVALUATION_INTERRUPTED')));
process.once('exit', () => {
  signalChild(previewServer);
  commandChildren.forEach((child) => signalChild(child, 'SIGKILL'));
  rmSync(state, { recursive: true, force: true });
});
app.once('will-quit', () => {
  if (finishing) app.exit(report.automatedPassed ? 0 : 1);
});

require(resolve(__dirname, '../dist/main/index.cjs'));
app
  .whenReady()
  .then(async () => {
    main = await waitFor(() => BrowserWindow.getAllWindows()[0]);
    main.webContents.setBackgroundThrottling(false);
    await waitFor(
      () =>
        !main.webContents.isLoading() &&
        evaluate('Boolean(window.api && document.querySelector("main"))'),
    );
    const settings = await evaluate('window.api.settings.getModel()');
    assert.ok(settings.hasApiKey, 'MODEL_CREDENTIAL_UNAVAILABLE');
    report.modelRef = `${settings.provider}/${settings.model}`;
    report.artifactHashes = {
      evaluator: hash(readFileSync(__filename)),
      cases: hash(readFileSync(resolve(__dirname, 'agent-quality-cases.cjs'))),
      main: hash(readFileSync(resolve(__dirname, '../dist/main/index.cjs'))),
      server: hash(readFileSync(resolve(__dirname, '../dist/main/server.cjs'))),
    };
    const grant = await evaluate('window.api.dialog.chooseProjectParent()');
    const project = await request('/projects/create', {
      directoryGrantId: grant.directoryGrantId,
      name: 'Agent 真实质量验收',
      code: 'agent-quality',
      pageDirectory: 'pages',
    });
    report.projectId = project.id;
    const deliveredProject = join(output, 'project');
    const { cpSync } = require('node:fs');
    for (const item of cases) {
      const record = {
        caseId: item.id,
        requirements: item.prompt,
        runIds: [],
        runs: [],
        checks: [],
        passed: false,
      };
      report.cases.push(record);
      let stage = 'agent';
      try {
        console.info(`Live quality task: ${item.id}`);
        const page = await request('/pages/create', {
          projectId: project.id,
          name: item.name,
          slug: item.id,
        });
        const scope = { projectId: project.id, pageId: page.id };
        record.pageId = page.id;
        const targetPath = join(project.path, 'src/pages', page.slug, 'schema.json');
        const shellPath = join(project.path, 'src/pages', page.slug, 'index.tsx');
        const originalTarget = snapshot(targetPath);
        const originalShell = snapshot(shellPath);
        const initial = await request('/pages/working-state/get', scope);
        const result = await runAgent(scope, item.prompt, record);
        let working = result.working;
        saveWorkingEvidence(record, working);
        stage = 'requirements';
        for (const [type, count] of Object.entries(item.types))
          assert.ok(
            Object.values(working.schema.elements).filter((element) => element.type === type)
              .length >= count,
            `MISSING_MATERIAL_${type}`,
          );
        assert.ok(
          working.schema.bindElements.some((binding) => binding.event === 'onClick'),
          'CLICK_BINDING_MISSING',
        );
        record.checks.push({ id: 'schema-requirements', passed: true });
        if (item.followUp) {
          stage = 'continuous-edit';
          const edited = await request('/pages/working-operations/apply', {
            ...scope,
            baseWorkingVersion: working.workingVersion,
            operations: [
              {
                operation: 'addElement',
                elementId: 'quality_manual_note',
                parentId: working.schema.layout.root,
                element: {
                  type: 'text',
                  props: { text: '人工调整保留标记', alias: '验收保留标记' },
                },
              },
            ],
          });
          const before = structuredClone(edited.schema);
          working = (await runAgent(scope, item.followUp, record, result.conversationId)).working;
          saveWorkingEvidence(record, working);
          const changedButton = Object.keys(before.elements).find(
            (id) => before.elements[id].props.alias === '登记按钮',
          );
          assert.ok(changedButton, 'FOLLOWUP_TARGET_MISSING');
          before.elements[changedButton].props.text = item.finalButton;
          assert.deepEqual(working.schema, before, 'FOLLOWUP_CHANGED_UNRELATED_CONTENT');
          record.checks.push({
            id: 'operation-pipeline-edit-then-agent',
            passed: true,
            limitation:
              'The non-Agent edit uses the same typed operation HTTP pipeline; visual editor gestures require separate acceptance.',
          });
        }
        assert.equal(snapshot(targetPath), originalTarget, 'EDIT_WROTE_TARGET');
        stage = 'restart-recovery';
        const previousBackend = currentBackend;
        previousBackend.kill();
        await waitFor(() => currentBackend !== previousBackend);
        await evaluate('window.api.backend.getConnection().then(() => true)');
        const resumed = await request('/pages/working-state/get', scope);
        assert.deepEqual(resumed, working, 'RESTART_LOST_DRAFT');
        record.checks.push({ id: 'draft-recovered-after-backend-restart', passed: true });
        stage = 'preview';
        await checkPreview(item, record, item.finalButton ?? item.button);
        stage = 'save-history-apply';
        const saved = await request('/pages/revisions/save', {
          ...scope,
          expectedWorkingVersion: working.workingVersion,
        });
        assert.equal(snapshot(targetPath), originalTarget, 'SAVE_WROTE_TARGET');
        const history = await request('/pages/revisions/list', scope);
        const restored = await request('/pages/revisions/restore', {
          ...scope,
          revisionId: initial.revisionId,
          expectedWorkingVersion: saved.workingVersion,
        });
        assert.deepEqual(restored.schema, initial.schema);
        const applicable = await request('/pages/revisions/restore', {
          ...scope,
          revisionId: saved.revisionId,
          expectedWorkingVersion: restored.workingVersion,
        });
        assert.equal(
          (await request('/pages/revisions/list', scope)).revisions.length,
          history.revisions.length,
        );
        const applyInput = {
          ...scope,
          expectedRevisionId: saved.revisionId,
          expectedWorkingVersion: applicable.workingVersion,
          clientRequestId: randomUUID(),
        };
        await request('/pages/apply', applyInput);
        await request('/pages/apply', applyInput);
        assert.deepEqual(JSON.parse(snapshot(targetPath)), working.schema);
        assert.equal(snapshot(shellPath), originalShell, 'APPLY_CHANGED_PAGE_SHELL');
        record.revisionId = saved.revisionId;
        record.workingVersion = applicable.workingVersion;
        record.targetHash = hash(snapshot(targetPath));
        record.checks.push({ id: 'explicit-save-history-restore-idempotent-apply', passed: true });
        record.workflowPassed = true;
      } catch (error) {
        record.failure = {
          stage,
          code: error.message.split('\n')[0],
          ...(error.renderEvidence ? { renderEvidence: error.renderEvidence } : {}),
        };
        if (record.pageId) {
          try {
            saveWorkingEvidence(
              record,
              await request('/pages/working-state/get', {
                projectId: project.id,
                pageId: record.pageId,
              }),
            );
          } catch {
            /* Preserve the original failure if recovery is unavailable. */
          }
        }
        console.info(`Task failed: ${item.id}, stage=${stage}`);
      }
      writeReport();
    }
    cpSync(project.path, deliveredProject, {
      recursive: true,
      filter: (path) => !path.includes(`${require('node:path').sep}.origamix`),
    });
    report.generatedProject = 'project';
    if (report.cases.some((item) => item.workflowPassed)) {
      report.standalone = { status: 'running', commands: [] };
      for (const args of [['install', '--ignore-scripts'], ['typecheck'], ['build']]) {
        await command(args, project.path);
        report.standalone.commands.push({ command: `pnpm ${args.join(' ')}`, passed: true });
        writeReport();
      }
      let serverUrl;
      previewServer = spawn(
        process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
        ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', '0'],
        {
          cwd: project.path,
          stdio: ['ignore', 'pipe', 'ignore'],
          detached: process.platform !== 'win32',
        },
      );
      previewServer.stdout.on('data', (chunk) => {
        serverUrl ??= chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      });
      await waitFor(() => serverUrl);
      for (const record of report.cases.filter((item) => item.workflowPassed)) {
        const item = cases.find((item) => item.id === record.caseId);
        const window = new BrowserWindow({
          width: 1280,
          height: 900,
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            backgroundThrottling: false,
          },
        });
        ownedWindows.push(window);
        await window.loadURL(`${serverUrl}/${item.id}`);
        const interaction = await exercise(
          window.webContents,
          'document',
          item,
          item.finalButton ?? item.button,
        );
        const filename = `${item.id}-standalone.png`;
        await capture(window.webContents, filename);
        record.checks.push({
          id: 'standalone-render-and-click',
          passed: true,
          screenshot: filename,
          interaction,
        });
        record.passed = true;
        window.destroy();
      }
      report.standalone.status = 'passed';
    }
    await finish();
  })
  .catch((error) => void finish(error));
