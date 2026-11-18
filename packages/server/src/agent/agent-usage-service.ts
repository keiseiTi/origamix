import type {
  AgentDailyUsage,
  AgentPageUsage,
  AgentTokenUsage,
  AgentUsageProject,
  AgentUsageScope,
  ProjectWithPages,
} from '@origamix/shared';
import { ApiError, notFound } from '../errors';
import type { AgentUsageRepository } from './agent-usage-repository';

const emptyUsage = (): AgentTokenUsage => ({ inputTokens: 0, outputTokens: 0, incompleteRuns: 0 });

const addUsage = (total: AgentTokenUsage, usage: AgentTokenUsage): void => {
  total.inputTokens += usage.inputTokens;
  total.outputTokens += usage.outputTokens;
  total.incompleteRuns += usage.incompleteRuns;
};

const localCalendar = (timeZone: string) => {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    throw new ApiError('统计时区无效', 400);
  }
  return (timestamp: string | Date) => formatter.format(new Date(timestamp));
};

const dateOffset = (date: string, offset: number): string => {
  const day = new Date(date);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
};

const recordedUsage = (
  run: Awaited<ReturnType<AgentUsageRepository['list']>>[number],
): AgentTokenUsage => ({
  inputTokens: run.reportedInputTokens,
  outputTokens: run.reportedOutputTokens,
  incompleteRuns: Number(run.interrupted || run.modelCalls > run.fullyReportedCalls),
});

const totalTokens = (usage: AgentTokenUsage) => usage.inputTokens + usage.outputTokens;

export class AgentUsageService {
  constructor(
    private readonly repository: AgentUsageRepository,
    private readonly listProjects: () => ProjectWithPages[] | Promise<ProjectWithPages[]>,
  ) {}

  private async projectTree(scope?: AgentUsageScope) {
    const projects = await this.listProjects();
    const project = projects.find(({ id }) => id === scope?.projectId);
    const page = project?.pages.find(({ id }) => id === scope?.pageId);
    if (scope && (!project || !page)) throw notFound('页面不存在或不属于当前项目');
    return {
      projects,
      scope:
        scope && project && page
          ? { ...scope, projectName: project.name, pageName: page.name }
          : undefined,
    };
  }

  async page(scope: AgentUsageScope, timeZone: string): Promise<AgentPageUsage> {
    const dateFor = localCalendar(timeZone);
    const date = dateFor(new Date());
    await this.projectTree(scope);
    const total = emptyUsage();
    const today = emptyUsage();
    for (const run of await this.repository.list(scope)) {
      const usage = recordedUsage(run);
      addUsage(total, usage);
      if (dateFor(run.createdAt) === date) addUsage(today, usage);
    }
    return { total, today };
  }

  async daily(input: {
    timeZone: string;
    days: 1 | 7 | 30;
    scope?: AgentUsageScope;
    detailDate?: string;
  }): Promise<AgentDailyUsage> {
    const dateFor = localCalendar(input.timeZone);
    const todayDate = dateFor(new Date());
    const { projects, scope } = await this.projectTree(input.scope);
    const days = Array.from({ length: input.days }, (_, index) => ({
      date: dateOffset(todayDate, index - input.days + 1),
      ...emptyUsage(),
    }));
    const daysByDate = new Map(days.map((day) => [day.date, day]));
    const pages = new Map(
      projects.flatMap((project) => project.pages.map((page) => [page.id, { project, page }])),
    );
    const details = new Map<string, AgentUsageProject>();
    // A one-day UTC buffer includes local midnight even in positive-offset zones.
    const earliest = `${dateOffset(days[0].date, -1)}T00:00:00.000Z`;
    for (const run of await this.repository.list(input.scope, earliest)) {
      const item = pages.get(run.pageId);
      const day = daysByDate.get(dateFor(run.createdAt));
      if (!item || item.project.id !== run.projectId || !day) continue;
      const usage = recordedUsage(run);
      addUsage(day, usage);
      if (
        (input.detailDate && day.date !== input.detailDate) ||
        (!totalTokens(usage) && !usage.incompleteRuns)
      )
        continue;
      let project = details.get(run.projectId);
      if (!project) {
        project = { projectId: run.projectId, name: item.project.name, ...emptyUsage(), pages: [] };
        details.set(run.projectId, project);
      }
      let page = project.pages.find(({ pageId }) => pageId === run.pageId);
      if (!page) {
        page = {
          projectId: run.projectId,
          pageId: run.pageId,
          name: item.page.name,
          ...emptyUsage(),
        };
        project.pages.push(page);
      }
      addUsage(project, usage);
      addUsage(page, usage);
    }
    const ranked = [...details.values()].sort((a, b) => totalTokens(b) - totalTokens(a));
    for (const project of ranked) project.pages.sort((a, b) => totalTokens(b) - totalTokens(a));
    const { inputTokens, outputTokens, incompleteRuns } = days[days.length - 1];
    return { today: { inputTokens, outputTokens, incompleteRuns }, days, projects: ranked, scope };
  }
}
