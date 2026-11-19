import { AgentService } from './agent-service';
import { agentTarget } from './agent-target';
import { ContextAssembler } from './context-assembler';
import { AgentEventBroker } from './event-broker';
import type { AgentEngine } from './agent-engine';
import type {
  AgentConversations,
  AgentProjects,
  AgentRunStore,
  AgentSchemaPage,
} from './persistence';
import { PiAgentEngine } from './pi-agent-engine';
import { createPiModels } from './pi-runtime';
import { ProductDocsProvider } from './product-docs-provider';
import { progressPayload } from './progress';
import { recoverAgentRunsOnStartup } from './run-recovery';
import { RunExecutor, type RunExecutorDependencies } from './run-executor';
import { AgentRunService } from './run-service';
import { createCompletePageRunTool } from './tools/complete-page-run';
import { createDomainAgentTools } from './tools/domain-tools';
import { createAgentElementIds } from './tools/element-ids';
import { createReadOnlyAgentTools } from './tools/read-only-tools';
import { createDefaultAgentToolEntries } from './tools/registry';
import { createValidatePageOperationsTool } from './tools/validate-page-operations';
import { getWorkingSchemaState } from '../schema/schema-service';
import { loadProjectMaterials } from '../projects/project-materials';
import type { RuntimeDiagnosticService } from '../diagnostics/diagnostic-service';
import type { ProjectTaskService } from './project-task-service';

export const createPageAgentEngine = (
  getCredential?: (provider: 'deepseek') => Promise<string | undefined>,
) => {
  const pi = createPiModels();
  return new PiAgentEngine({
    resolveModel: (provider, model) => pi.models.getModel(provider, model),
    stream: pi.models.streamSimple.bind(pi.models),
    getCredential: async (provider) =>
      provider === 'deepseek' ? getCredential?.(provider) : undefined,
  });
};

export const createPageAgentRuntime = (input: {
  projects: AgentProjects;
  resolvePage: AgentSchemaPage;
  runs: AgentRunStore;
  conversations: AgentConversations;
  history: ConstructorParameters<typeof ContextAssembler>[1];
  diagnostics: RuntimeDiagnosticService;
  engine: AgentEngine;
  budget: NonNullable<ConstructorParameters<typeof AgentService>[0]['budget']>;
  getCurrentState: ConstructorParameters<typeof AgentService>[0]['getCurrentState'];
  getModelRef?: () => Promise<string>;
  loadMaterials?: typeof loadProjectMaterials;
  getPageRoles: NonNullable<ConstructorParameters<typeof ContextAssembler>[4]>;
  prepareProject?: ProjectTaskService['prepare'];
  authorizeStart?: ProjectTaskService['assertContinuation'];
  recordReportedUsage: RunExecutorDependencies['recordReportedUsage'];
  recordModelUsage?: RunExecutorDependencies['recordModelUsage'];
  audit: NonNullable<RunExecutorDependencies['audit']>;
}) => {
  const { projects, resolvePage, runs, conversations, diagnostics } = input;
  const loadMaterials = input.loadMaterials ?? loadProjectMaterials;
  const runService = new AgentRunService(runs);
  const events = new AgentEventBroker();
  runService.setTransitionListener((run) => {
    const payload = progressPayload(run.status);
    if (payload)
      events.publish({
        type: 'run.progress',
        runId: run.id,
        pageId: run.pageId,
        target: agentTarget(run.projectId, run.pageId),
        requestId: run.clientRequestId,
        payload,
      });
  });
  const docs = new ProductDocsProvider();
  const context = new ContextAssembler(
    { getCurrent: getWorkingSchemaState },
    input.history,
    docs,
    {},
    input.getPageRoles,
    loadMaterials,
    Boolean(input.prepareProject),
  );
  const executor = new RunExecutor({
    projects,
    resolvePage,
    runs,
    conversations,
    runService,
    context,
    engine: input.engine,
    recordReportedUsage: input.recordReportedUsage,
    recordModelUsage: input.recordModelUsage,
    createTools: (scope) => {
      const ids = createAgentElementIds();
      return createDefaultAgentToolEntries([
        ...createReadOnlyAgentTools(
          {
            runId: scope.runId,
            projectId: scope.projectId,
            pageId: scope.pageId,
            workingVersion: scope.baseWorkingVersion,
          },
          { projects, resolvePage, loadMaterials, getProjectRoles: input.getPageRoles },
          ids,
        ),
        ...createDomainAgentTools(scope, { projects, docs, diagnostics }),
        createValidatePageOperationsTool(projects, scope, ids, resolvePage),
        createCompletePageRunTool(
          {
            projects,
            resolvePage,
            loadMaterials,
            runs,
            runService,
            prepareProject: input.prepareProject,
          },
          scope,
          ids,
        ),
      ]);
    },
    audit: async (audit) => {
      await input.audit(audit);
      const run = await runs.get(audit.runId);
      if (run)
        events.publish({
          type: 'tool.activity',
          runId: run.id,
          pageId: run.pageId,
          target: agentTarget(run.projectId, run.pageId),
          requestId: run.clientRequestId,
          payload: {
            toolName: audit.toolName,
            phase: audit.phase,
            ...(audit.safeErrorCode ? { safeErrorCode: audit.safeErrorCode } : {}),
          },
        });
    },
  });
  const service = new AgentService({
    projects,
    runs,
    conversations,
    runService,
    events,
    executor,
    budget: input.budget,
    getCurrentState: input.getCurrentState,
    getModelRef: input.getModelRef,
    authorizeStart: input.authorizeStart,
  });
  return {
    http: { conversations, runs: runService, events, service },
    recover: () => recoverAgentRunsOnStartup(runs, projects, conversations, resolvePage),
  };
};
