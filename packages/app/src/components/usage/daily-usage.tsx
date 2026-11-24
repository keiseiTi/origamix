import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, type BarRectangleItem } from 'recharts';
import {
  Button,
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@origamix/ui';
import type { AgentDailyUsage, AgentTokenUsage, AgentUsageScope } from '@origamix/shared';
import { agentUsageService, usageTimeZone } from '@/services/agent-usage';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from './chart';
import { compactTokens, formatTokens, totalTokens } from './format';

const ranges = [
  { days: 1, label: '今日' },
  { days: 7, label: '近 7 天' },
  { days: 30, label: '近 30 天' },
] as const;

const chartConfig = {
  inputTokens: { label: '输入', color: 'var(--chart-1)' },
  outputTokens: { label: '输出', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const UsageCount = ({ usage }: { usage: AgentTokenUsage }): React.JSX.Element => (
  <span className='text-right tabular-nums'>
    {totalTokens(usage) || !usage.incompleteRuns
      ? `${formatTokens(totalTokens(usage))} tokens`
      : '用量未记录'}
    {usage.incompleteRuns > 0 && totalTokens(usage) > 0 && (
      <span className='block text-xs text-muted-foreground'>部分运行记录缺失</span>
    )}
  </span>
);

export const DailyUsage = ({
  initialScope,
}: {
  initialScope?: AgentUsageScope;
}): React.JSX.Element => {
  const [scope, setScope] = useState(initialScope);
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [detailDate, setDetailDate] = useState<string>();
  const [timeZone] = useState(usageTimeZone);
  const [attempt, setAttempt] = useState(0);
  const chartKey = JSON.stringify([days, scope?.projectId, scope?.pageId]);
  const queryKey = JSON.stringify([chartKey, detailDate, attempt]);
  const [response, setResponse] = useState<{
    chartKey: string;
    queryKey: string;
    data: AgentDailyUsage;
  }>();
  const [failedQuery, setFailedQuery] = useState<string>();

  useEffect(() => {
    let active = true;
    void agentUsageService.daily(days, timeZone, scope, detailDate).then(
      (data) => {
        if (active) setResponse({ chartKey, queryKey, data });
      },
      () => {
        if (active) setFailedQuery(queryKey);
      },
    );
    return () => {
      active = false;
    };
  }, [days, timeZone, scope, detailDate, chartKey, queryKey]);

  const summary = response?.chartKey === chartKey ? response.data : undefined;
  const details = response?.queryKey === queryKey ? response.data.projects : undefined;
  const failed = failedQuery === queryKey;
  const missingRuns = summary?.days.reduce((total, day) => total + day.incompleteRuns, 0) ?? 0;
  const hasUsage = summary?.days.some((day) => totalTokens(day) > 0);
  const selectBarDate = ({ originalDataIndex }: BarRectangleItem) => {
    if (days > 1) setDetailDate(summary?.days[originalDataIndex]?.date);
  };
  return (
    <section className='space-y-5'>
      <div>
        <h2 className='text-base font-semibold'>页面 Agent 用量</h2>
        <p className='mt-1 text-xs text-muted-foreground'>按运行开始时间统计</p>
      </div>

      {scope && (
        <div className='flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm'>
          <span className='min-w-0 truncate'>
            {summary?.scope
              ? `${summary.scope.projectName} / ${summary.scope.pageName}`
              : '当前页面'}
          </span>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              setScope(undefined);
              setDetailDate(undefined);
            }}
          >
            查看全部项目
          </Button>
        </div>
      )}

      <Card className='gap-3 p-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <h3 className='text-sm font-medium'>今日 Token 用量</h3>
            <div className='mt-1 text-2xl font-semibold'>
              {summary ? <UsageCount usage={summary.today} /> : '—'}
            </div>
            {summary && (
              <p className='mt-1 text-xs text-muted-foreground'>
                输入 {formatTokens(summary.today.inputTokens)} · 输出{' '}
                {formatTokens(summary.today.outputTokens)}
              </p>
            )}
          </div>
          <div className='flex gap-1' role='group' aria-label='统计范围'>
            {ranges.map((range) => (
              <Button
                type='button'
                key={range.days}
                size='sm'
                variant={days === range.days ? 'secondary' : 'ghost'}
                aria-pressed={days === range.days}
                onClick={() => {
                  setDays(range.days);
                  setDetailDate(undefined);
                }}
              >
                {range.label}
              </Button>
            ))}
          </div>
        </div>
        {summary && (
          <>
            <div className='flex items-center justify-between gap-3'>
              <h3 className='text-sm font-medium'>每日趋势</h3>
              <div className='flex gap-3 text-xs text-muted-foreground'>
                {Object.entries(chartConfig).map(([key, item]) => (
                  <span key={key} className='flex items-center gap-1.5'>
                    <span className='size-2 rounded-xs' style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <ChartContainer config={chartConfig}>
              <BarChart
                accessibilityLayer
                title='页面 Agent 每日 Token 用量'
                data={summary.days}
                margin={{ left: 0, right: 4, top: 6 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey='date'
                  tickFormatter={(date: string) => date.slice(5)}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  allowDecimals={false}
                  tickFormatter={compactTokens}
                  width={44}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, hasUsage ? 'auto' : 1]}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey='inputTokens'
                  stackId='tokens'
                  fill='var(--color-inputTokens)'
                  maxBarSize={30}
                  isAnimationActive={false}
                  className={days > 1 ? 'cursor-pointer' : undefined}
                  onClick={selectBarDate}
                />
                <Bar
                  dataKey='outputTokens'
                  stackId='tokens'
                  fill='var(--color-outputTokens)'
                  maxBarSize={30}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                  className={days > 1 ? 'cursor-pointer' : undefined}
                  onClick={selectBarDate}
                />
              </BarChart>
            </ChartContainer>
            {missingRuns > 0 && (
              <p className='text-xs text-muted-foreground' role='status'>
                此时段有 {missingRuns} 次运行的用量记录不完整。总量仅包含已记录的 Token。
              </p>
            )}
          </>
        )}
      </Card>

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h3 className='text-sm font-semibold'>项目与页面明细</h3>
        {summary && days > 1 && (
          <Select
            value={detailDate ?? 'all'}
            items={[
              { value: 'all', label: '所选时段' },
              ...summary.days.map(({ date }) => ({ value: date, label: date })),
            ]}
            onValueChange={(value) =>
              setDetailDate(value === 'all' ? undefined : (value ?? undefined))
            }
          >
            <SelectTrigger aria-label='明细日期'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value='all'>所选时段</SelectItem>
              {summary.days.map(({ date }) => (
                <SelectItem key={date} value={date}>
                  {date}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {failed ? (
        <div className='flex items-center gap-3 text-sm' role='alert'>
          无法读取用量。
          <Button size='sm' variant='outline' onClick={() => setAttempt((value) => value + 1)}>
            重试
          </Button>
        </div>
      ) : !details ? (
        <p className='flex items-center gap-2 text-sm text-muted-foreground' role='status'>
          <Spinner /> 正在读取用量…
        </p>
      ) : details.length === 0 ? (
        <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
          所选时段暂无用量记录。
        </p>
      ) : (
        <div className='divide-y rounded-lg border'>
          {details.map((project) => (
            <details
              key={project.projectId}
              open={scope ? true : undefined}
              className='p-3 text-sm'
            >
              <summary className='cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-ring'>
                <span className='inline-flex w-[calc(100%-1.3rem)] items-baseline justify-between gap-3'>
                  <span className='font-medium'>{project.name}</span>
                  <UsageCount usage={project} />
                </span>
              </summary>
              <ul className='mt-2 space-y-2 border-t pt-2 pl-4'>
                {project.pages.map((page) => (
                  <li key={page.pageId} className='flex flex-wrap justify-between gap-x-3 gap-y-1'>
                    <span>{page.name}</span>
                    <span className='ml-auto text-muted-foreground'>
                      输入 {formatTokens(page.inputTokens)} · 输出 {formatTokens(page.outputTokens)}
                    </span>
                    <UsageCount usage={page} />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
};
