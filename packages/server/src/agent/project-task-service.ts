import { Check } from '@sinclair/typebox/value';
import {
  ProjectProposalSchema,
  applyProjectRoleOperations,
  type ProjectProposal,
  type ProjectRoleOperation,
  type ProjectTaskScope,
  type ProjectTaskDecision,
  type ProjectTaskState,
  type CreateAgentRunRequest,
} from '@origamix/shared';
import { equalJson } from '@origamix/shared';
import type { ProjectService } from '../projects/project-service';
import type { ProjectRepository } from '../projects/project-repository';
import type { AgentRunRepository } from './run-repository';
import type { AgentService } from './agent-service';
import { ProjectTaskStore } from '../projects/project-task-store';
import { KeyedQueue } from '../infrastructure/keyed-queue';
import { withProjectActivity } from '../projects/project-activity';
import { ApiError, conflict, invalid, notFound } from '../errors';

const decisions = new KeyedQueue();
/** Durable project proposal -> existing single-page Run. Reads never resume execution. */
export class ProjectTaskService {
  private readonly store = new ProjectTaskStore();
  constructor(
    private readonly dependencies: {
      projects: Pick<ProjectRepository, 'getProject' | 'getPage'>;
      projectService: Pick<ProjectService, 'getPageRoles' | 'updatePageRoles'>;
      runs: Pick<AgentRunRepository, 'get' | 'findByClientRequest'>;
      getWorkingVersion: (projectId: string, pageId: string) => Promise<number>;
      startPage: AgentService['start'];
    },
  ) {}

  async prepare(
    projectId: string,
    operations: ProjectRoleOperation[],
    response: string,
    pageIntent?: string,
  ): Promise<ProjectProposal> {
    const state = await this.dependencies.projectService.getPageRoles(projectId);
    try {
      return {
        expectedManifestHash: state.manifestHash,
        before: state.roles,
        after: applyProjectRoleOperations(state.roles, operations, state.pages),
        operations,
        pages: state.pages,
        response,
        ...(pageIntent ? { pageIntent } : {}),
      };
    } catch {
      throw invalid('项目角色操作无效，请核实角色和目标页面');
    }
  }

  private source(input: ProjectTaskScope) {
    const run = this.dependencies.runs.get(input.runId);
    const project = this.dependencies.projects.getProject(input.projectId);
    if (
      !run ||
      !project ||
      project.status !== 0 ||
      !this.dependencies.projects.getPage(input.projectId, input.pageId) ||
      run.projectId !== input.projectId ||
      run.pageId !== input.pageId
    )
      throw notFound('项目任务不属于当前页面');
    if (
      run.status !== 'completed' ||
      run.outcome !== 'needs_project_confirmation' ||
      !Check(ProjectProposalSchema, run.outcomeJson)
    )
      throw conflict('项目提案尚未就绪或已失效');
    return { run, project, proposal: run.outcomeJson };
  }
  private childRequestId(runId: string): string {
    return `project_${runId}`;
  }

  async get(input: ProjectTaskScope): Promise<ProjectTaskState> {
    const { project, proposal } = this.source(input);
    return withProjectActivity(project.path, async () => {
      const retained = await this.store.read(project.path, input.runId);
      if (
        retained &&
        (retained.projectId !== input.projectId ||
          retained.pageId !== input.pageId ||
          !equalJson(retained.proposal, proposal))
      )
        throw conflict('项目任务记录归属或提案不一致');
      const state: ProjectTaskState = retained ?? {
        ...input,
        proposal,
        phase: 'awaiting_confirmation',
      };
      if (state.phase === 'cancelled') return state;
      const child = this.dependencies.runs.findByClientRequest(
        input.projectId,
        input.pageId,
        this.childRequestId(input.runId),
      );
      if (child)
        return {
          ...state,
          childRunId: child.id,
          pageStatus: child.status,
          phase:
            child.status === 'completed'
              ? 'completed'
              : ['failed', 'cancelled', 'interrupted'].includes(child.status)
                ? 'page_failed'
                : 'running_page',
        };
      return state;
    });
  }

  async assertContinuation(request: CreateAgentRunRequest): Promise<void> {
    if (!request.retryOfRunId) return;
    const parent = this.dependencies.runs.get(request.retryOfRunId);
    if (parent?.outcome !== 'needs_project_confirmation') return;
    if (!request.pageId) throw conflict('项目提案不能跨目标继续');
    const state = await this.get({
      projectId: request.projectId,
      pageId: request.pageId,
      runId: parent.id,
    });
    if (
      !['project_applied', 'running_page', 'completed', 'page_failed'].includes(state.phase) ||
      request.clientRequestId !== this.childRequestId(parent.id) ||
      request.baseWorkingVersion !== parent.baseWorkingVersion ||
      request.conversationId !== parent.conversationId ||
      !state.proposal.pageIntent ||
      request.content.blocks.length !== 1 ||
      request.content.blocks[0]?.type !== 'text' ||
      request.content.blocks[0].text !== this.pageInstruction(state.proposal.pageIntent)
    )
      throw conflict('项目操作尚未确认或后续页面请求不一致');
  }
  private pageInstruction(intent: string): string {
    return `项目配置已经由用户确认并成功保存。本轮只执行以下当前页面任务，不再提议项目操作：\n${intent}`;
  }

  decide(input: ProjectTaskDecision): Promise<ProjectTaskState> {
    return decisions.run(input.runId, async () => {
      const { project, run, proposal } = this.source(input);
      let state = await this.get({
        projectId: input.projectId,
        pageId: input.pageId,
        runId: input.runId,
      });
      if (input.decision === 'cancel') {
        if (state.phase === 'cancelled') return state;
        if (state.phase !== 'awaiting_confirmation')
          throw conflict('项目操作已开始，请先读取实际结果');
        state = { ...state, phase: 'cancelled' };
        await withProjectActivity(project.path, () => this.store.write(project.path, state));
        return state;
      }
      if (state.phase === 'cancelled') throw conflict('任务已取消，不会执行后续操作');
      if (['running_page', 'completed', 'page_failed', 'project_failed'].includes(state.phase))
        return state;
      if (state.phase === 'awaiting_confirmation') {
        if (
          (await this.dependencies.getWorkingVersion(input.projectId, input.pageId)) !==
          run.baseWorkingVersion
        ) {
          state = { ...state, phase: 'project_failed', failure: '页面草稿已变化，请重新发起请求' };
          await withProjectActivity(project.path, () => this.store.write(project.path, state));
          return state;
        }
        state = { ...state, phase: 'applying_project' };
        await withProjectActivity(project.path, () => this.store.write(project.path, state));
      }
      if (state.phase === 'applying_project') {
        try {
          await this.dependencies.projectService.updatePageRoles({
            projectId: input.projectId,
            roles: proposal.after,
            expectedManifestHash: proposal.expectedManifestHash,
            clientRequestId: this.childRequestId(run.id),
          });
        } catch (error) {
          if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
            state = {
              ...state,
              phase: 'project_failed',
              failure: '项目配置已变化或操作不再有效，请重新发起请求',
            };
            await withProjectActivity(project.path, () => this.store.write(project.path, state));
            return state;
          }
          throw error;
        }
        state = { ...state, phase: proposal.pageIntent ? 'project_applied' : 'completed' };
        await withProjectActivity(project.path, () => this.store.write(project.path, state));
      }
      if (state.phase === 'project_applied' && proposal.pageIntent) {
        if (
          (await this.dependencies.getWorkingVersion(input.projectId, input.pageId)) !==
          run.baseWorkingVersion
        ) {
          state = {
            ...state,
            phase: 'page_failed',
            failure: '项目配置已保存，但页面草稿已变化，请重新发起页面请求',
          };
          await withProjectActivity(project.path, () => this.store.write(project.path, state));
          return state;
        }
        const latest = await this.dependencies.projectService.getPageRoles(input.projectId);
        if (!equalJson(latest.roles, proposal.after)) {
          state = {
            ...state,
            phase: 'page_failed',
            failure: '项目角色在确认后已变化，请重新发起页面请求',
          };
          await withProjectActivity(project.path, () => this.store.write(project.path, state));
          return state;
        }
        const started = await this.dependencies.startPage({
          version: '1',
          projectId: input.projectId,
          pageId: input.pageId,
          target: { kind: 'page', projectId: input.projectId, pageId: input.pageId },
          conversationId: run.conversationId,
          clientRequestId: this.childRequestId(run.id),
          baseWorkingVersion: run.baseWorkingVersion,
          retryOfRunId: run.id,
          content: {
            version: '1',
            blocks: [{ type: 'text', text: this.pageInstruction(proposal.pageIntent) }],
          },
        });
        state = {
          ...state,
          phase: 'running_page',
          childRunId: started.run.id,
          pageStatus: started.run.status,
        };
        await withProjectActivity(project.path, () => this.store.write(project.path, state));
      }
      return state;
    });
  }
}
