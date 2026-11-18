export interface AgentUsageScope {
  projectId: string;
  pageId: string;
}

export interface AgentTokenUsage {
  inputTokens: number;
  outputTokens: number;
  incompleteRuns: number;
}

export interface AgentPageUsage {
  total: AgentTokenUsage;
  today: AgentTokenUsage;
}

export interface AgentUsageDay extends AgentTokenUsage {
  date: string;
}

export interface AgentUsagePage extends AgentTokenUsage, AgentUsageScope {
  name: string;
}

export interface AgentUsageProject extends AgentTokenUsage {
  projectId: string;
  name: string;
  pages: AgentUsagePage[];
}

export interface AgentDailyUsage {
  today: AgentTokenUsage;
  days: AgentUsageDay[];
  projects: AgentUsageProject[];
  scope?: AgentUsageScope & { pageName: string; projectName: string };
}
