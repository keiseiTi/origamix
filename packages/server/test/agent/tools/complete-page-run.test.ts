import { expect, it } from 'vitest';
import { loadProjectMaterials } from '../../../src/projects/project-materials';
import { createCompletePageRunTool } from '../../../src/agent/tools/complete-page-run';

it('reports the invalid terminal field so a rejected reset can be repaired', async () => {
  const tool = createCompletePageRunTool(
    {
      projects: {} as never,
      runs: {} as never,
      runService: {} as never,
      loadMaterials: loadProjectMaterials,
    },
    {
      runId: 'run_test',
      messageId: 'message_test',
      projectId: 'project_test',
      pageId: 'page_test',
      baseWorkingVersion: 1,
      maxSchemaBytes: 1024,
      maxRepairAttempts: 1,
    },
  );
  await expect(
    tool.execute(
      {
        outcome: 'apply_changes',
        operations: [
          { operation: 'removeElement', elementId: 'form_main', removeDescendants: true },
        ],
      },
      new AbortController().signal,
    ),
  ).rejects.toThrow('/response');
  await expect(
    tool.execute(
      { outcome: 'no_change_needed', reason: '无法重置', response: '页面无需修改' },
      new AbortController().signal,
    ),
  ).rejects.toThrow('不能报告无需修改');
});
