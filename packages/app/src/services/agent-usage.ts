import type { AgentDailyUsage, AgentPageUsage, AgentUsageScope } from '@origamix/shared';
import { request } from './request';

export const usageTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const agentUsageService = {
  page: (scope: AgentUsageScope) =>
    request<AgentPageUsage>('/agent/usage/page', { ...scope, timeZone: usageTimeZone() }),
  daily: (days: 1 | 7 | 30, timeZone: string, scope?: AgentUsageScope, detailDate?: string) =>
    request<AgentDailyUsage>('/agent/usage/daily', { days, timeZone, scope, detailDate }),
};
