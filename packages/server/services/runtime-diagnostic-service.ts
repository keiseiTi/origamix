import {
  type PageRuntimeState,
  type RuntimeDiagnostic,
  type RuntimeRenderReport,
  type RuntimeReportResult,
} from '@origamix/shared/protocol/agent';
import { validateRuntimeRenderReport } from '@origamix/shared/protocol/agent-validation';
import { invalid, notFound } from '../errors';
import type { ProjectRepository } from '../repositories/project-repository';
import type { RuntimeDiagnosticRepository } from '../repositories/runtime-diagnostic-repository';

const SECRET_PATTERNS = [
  /\bBearer\s+\S+/gi,
  /\b(?:api[_-]?key|authorization|token|secret|password)\s*[:=]\s*[^\s,;]+/gi,
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /(?:file:\/\/)?\/(?:Users|home)\/[^\s]+/g,
];

export const redactRuntimeMessage = (message: string): string => {
  let safe = message;
  for (const pattern of SECRET_PATTERNS) safe = safe.replace(pattern, '[REDACTED]');
  return safe.slice(0, 2_000) || '运行时错误';
};

export class RuntimeDiagnosticService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly diagnostics: RuntimeDiagnosticRepository,
    private readonly getCurrentRevisionId: (projectId: string, pageId: string) => Promise<string>,
  ) {}

  async report(report: RuntimeRenderReport): Promise<RuntimeReportResult> {
    if (!validateRuntimeRenderReport(report).valid) throw invalid('Runtime 诊断格式无效');
    this.assertPage(report.projectId, report.pageId);
    if (
      report.outcome === 'success' &&
      report.diagnostics.some((item) => item.severity === 'error')
    )
      throw invalid('成功渲染不能包含错误诊断');
    if (
      report.outcome === 'failed' &&
      !report.diagnostics.some((item) => item.severity === 'error')
    )
      throw invalid('失败渲染必须包含错误诊断');
    if (
      report.diagnostics.some(
        (item) => item.pageId !== report.pageId || item.revisionId !== report.revisionId,
      )
    )
      throw invalid('Runtime 诊断归属不匹配');

    const currentRevisionId = await this.getCurrentRevisionId(report.projectId, report.pageId);
    if (currentRevisionId !== report.revisionId) {
      return {
        version: '1',
        disposition: 'stale',
        currentRevisionId,
      };
    }

    const safeDiagnostics = report.diagnostics.map((item): RuntimeDiagnostic => ({
      ...item,
      safeMessage: redactRuntimeMessage(item.safeMessage),
    }));
    this.diagnostics.replaceForRevision(
      report.projectId,
      report.pageId,
      report.revisionId,
      safeDiagnostics,
      report.observedAt,
    );
    return {
      version: '1',
      disposition: 'accepted',
      currentRevisionId,
    };
  }

  async getState(projectId: string, pageId: string): Promise<PageRuntimeState> {
    this.assertPage(projectId, pageId);
    const currentRevisionId = await this.getCurrentRevisionId(projectId, pageId);
    return {
      version: '1',
      projectId,
      pageId,
      currentRevisionId,
      diagnostics: this.diagnostics.listForRevision(projectId, pageId, currentRevisionId),
    };
  }

  private assertPage(projectId: string, pageId: string): void {
    if (!this.projects.getProject(projectId) || !this.projects.getPage(projectId, pageId))
      throw notFound('页面不存在');
  }
}
