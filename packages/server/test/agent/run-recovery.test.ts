import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationDatabase } from '../../database/database';
import { ProjectRepository } from '../../projects/project-repository';
import { ProjectService } from '../../projects/project-service';
import { ProjectApplyService } from '../../schema/project-apply-service';
import {
  applyWorkingSchemaOperations,
  getWorkingSchemaState,
  updateWorkingSchema,
} from '../../schema/schema-service';
import { AgentRunRepository } from '../../agent/run-repository';
import { AgentRunService } from '../../agent/run-service';
import { ConversationRepository } from '../../conversations/conversation-repository';
import { ConversationService } from '../../conversations/conversation-service';
import { recoverAgentRunsOnStartup } from '../../agent/run-recovery';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

const setup = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-agent-receipt-'));
  directories.push(directory);
  const database = new ApplicationDatabase(':memory:');
  const projects = new ProjectRepository(database);
  const projectService = new ProjectService(
    projects,
    fileURLToPath(new URL('../../../template', import.meta.url)),
    new ProjectApplyService(projects),
  );
  projectService.registerGrant('grant', directory);
  const project = await projectService.createProject({
    directoryGrantId: 'grant',
    name: 'Receipt',
    code: 'receipt',
  });
  const page = await projectService.createPage(project.id, { name: 'Home', slug: 'home' });
  const pageRef = {
    projectPath: project.path,
    pageId: page.id,
    slug: page.slug,
    relativePath: page.relativePath,
  };
  const runs = new AgentRunRepository(database);
  const conversations = new ConversationService(
    database,
    projects,
    new ConversationRepository(database),
    runs,
  );
  return { database, projects, project, page, pageRef, runs, conversations };
};

const startApplyingRun = async (fixture: Awaited<ReturnType<typeof setup>>, requestId: string) => {
  const current = await getWorkingSchemaState(fixture.pageRef);
  const operationDigest = `${requestId}-digest`;
  const started = fixture.conversations.startRun({
    projectId: fixture.project.id,
    pageId: fixture.page.id,
    clientRequestId: requestId,
    baseWorkingVersion: current.workingVersion,
    content: { version: '1', blocks: [{ type: 'text', text: '修改页面' }] },
    modelRef: 'deepseek/deepseek-flash',
    runKind: 'page_assistant',
    budget: {
      maxModelCalls: 2,
      maxToolCalls: 2,
      maxOutputTokens: 100,
      maxDurationMs: 10_000,
      maxSchemaBytes: 10_000,
      maxRepairAttempts: 1,
    },
    promptVersion: '1',
    policyVersion: '1',
    toolsetVersion: '1',
    materialManifestVersion: 'official-antd@1.0.0',
  });
  const service = new AgentRunService(fixture.runs);
  service.transition(started.run.id, 'preparing');
  service.transition(started.run.id, 'reasoning');
  service.transition(started.run.id, 'reading');
  service.transition(started.run.id, 'deciding', {
    outcomeJson: {
      outcome: 'apply_changes',
      operations: [],
      response: '页面已经完成修改。',
    },
    operationCount: 1,
    operationDigest,
  });
  service.transition(started.run.id, 'validating');
  return { run: started.run, current, operationDigest };
};

describe('Agent Working commit receipt recovery', () => {
  it('recovers a Working write completed before the Run result was persisted', async () => {
    const fixture = await setup();
    try {
      const started = await startApplyingRun(fixture, 'committed-before-db');
      const committed = await applyWorkingSchemaOperations(
        fixture.pageRef,
        {
          baseWorkingVersion: started.current.workingVersion,
          operations: [
            {
              operation: 'updateElementProps',
              elementId: started.current.schema.layout.root,
              set: { padding: 24 },
            },
          ],
        },
        {
          agentCommit: {
            runId: started.run.id,
            projectId: fixture.project.id,
            operationDigest: started.operationDigest,
          },
        },
      );
      await recoverAgentRunsOnStartup(fixture.runs, fixture.projects, fixture.conversations);
      await recoverAgentRunsOnStartup(fixture.runs, fixture.projects, fixture.conversations);
      expect(fixture.runs.get(started.run.id)).toMatchObject({
        status: 'completed',
        outcome: 'changed',
        resultWorkingVersion: committed.workingVersion,
        resultWorkingHash: committed.workingHash,
      });
      expect(
        fixture.conversations
          .history(fixture.project.id, fixture.page.id, started.run.conversationId)
          .find(({ role }) => role === 'assistant'),
      ).toMatchObject({
        status: 'completed',
        content: { blocks: [{ type: 'text', text: '页面已经完成修改。' }] },
      });
      expect(
        fixture.conversations
          .history(fixture.project.id, fixture.page.id, started.run.conversationId)
          .filter(({ role }) => role === 'assistant'),
      ).toHaveLength(1);
    } finally {
      fixture.database.close();
    }
  });

  it('fails closed when the receipt no longer matches the current Working state', async () => {
    const fixture = await setup();
    try {
      const started = await startApplyingRun(fixture, 'receipt-conflict');
      const committed = await applyWorkingSchemaOperations(
        fixture.pageRef,
        {
          baseWorkingVersion: started.current.workingVersion,
          operations: [
            {
              operation: 'updateElementProps',
              elementId: started.current.schema.layout.root,
              set: { padding: 40 },
            },
          ],
        },
        {
          agentCommit: {
            runId: started.run.id,
            projectId: fixture.project.id,
            operationDigest: started.operationDigest,
          },
        },
      );
      await updateWorkingSchema(fixture.pageRef, {
        baseWorkingVersion: committed.workingVersion,
        schema: {
          ...committed.schema,
          elements: {
            ...committed.schema.elements,
            [committed.schema.layout.root]: {
              ...committed.schema.elements[committed.schema.layout.root]!,
              props: {
                ...committed.schema.elements[committed.schema.layout.root]!.props,
                padding: 48,
              },
            },
          },
        },
      });
      await recoverAgentRunsOnStartup(fixture.runs, fixture.projects, fixture.conversations);
      expect(fixture.runs.get(started.run.id)).toMatchObject({
        status: 'failed',
        errorCode: 'AGENT_COMMIT_RECOVERY_CONFLICT',
      });
    } finally {
      fixture.database.close();
    }
  });

  it('interrupts without mutation when failure occurs after receipt preparation', async () => {
    const fixture = await setup();
    try {
      const started = await startApplyingRun(fixture, 'prepared-only');
      await expect(
        applyWorkingSchemaOperations(
          fixture.pageRef,
          {
            baseWorkingVersion: started.current.workingVersion,
            operations: [
              {
                operation: 'updateElementProps',
                elementId: started.current.schema.layout.root,
                set: { padding: 32 },
              },
            ],
          },
          {
            agentCommit: {
              runId: started.run.id,
              projectId: fixture.project.id,
              operationDigest: started.operationDigest,
            },
            afterWorkingStage: (stage) => {
              if (stage === 'receipt_prepared') throw new Error('simulated interruption');
            },
          },
        ),
      ).rejects.toThrow('simulated interruption');
      await recoverAgentRunsOnStartup(fixture.runs, fixture.projects, fixture.conversations);
      expect(fixture.runs.get(started.run.id)).toMatchObject({
        status: 'interrupted',
        errorCode: 'PROCESS_INTERRUPTED',
      });
      expect((await getWorkingSchemaState(fixture.pageRef)).workingVersion).toBe(
        started.current.workingVersion,
      );
    } finally {
      fixture.database.close();
    }
  });
});
