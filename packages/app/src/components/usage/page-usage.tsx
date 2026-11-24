import { ErrorToast } from '@/components/error-toast';
import { useEffect, useState } from 'react';
import { Activity, ChevronUp } from 'lucide-react';
import { Button } from '@origamix/ui';
import type { AgentPageUsage, AgentUsageScope } from '@origamix/shared';
import { agentUsageService } from '@/services/agent-usage';
import { compactTokens, formatTokens, totalTokens } from './format';

export const PageUsage = ({
  projectId,
  pageId,
  runId,
  runStatus,
  onOpenUsage,
}: AgentUsageScope & {
  runId?: string;
  runStatus?: string;
  onOpenUsage: (scope: AgentUsageScope) => void;
}): React.JSX.Element => {
  const [result, setResult] = useState<AgentPageUsage>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let requestVersion = 0;
    const refresh = () => {
      const version = ++requestVersion;
      void agentUsageService.page({ projectId, pageId }).then(
        (data) => {
          if (!active || version !== requestVersion) return;
          setError(undefined);
          setResult(data);
        },
        (reason: unknown) => {
          if (active && version === requestVersion)
            setError(reason instanceof Error ? reason.message : '无法读取页面用量');
        },
      );
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
    };
  }, [projectId, pageId, runId, runStatus, attempt]);

  const total = result && totalTokens(result.total);
  return (
    <details>
      <summary className='flex min-h-6 cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 text-[10px] text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden'>
        <Activity size={12} />
        {error
          ? '页面用量读取失败'
          : total === undefined
            ? '正在读取页面用量…'
            : total === 0 && result?.total.incompleteRuns
              ? '页面用量未记录'
              : `本页累计 ${compactTokens(total)} tokens`}
        <ChevronUp size={12} />
      </summary>
      <div className='absolute bottom-full left-1/2 z-10 mb-2 w-64 max-w-full -translate-x-1/2 rounded-lg border bg-popover p-3 text-left text-sm text-popover-foreground shadow-lg'>
        {error ? (
          <div className='flex items-center justify-between gap-2'>
            <ErrorToast message={error} />
            <Button size='sm' variant='outline' onClick={() => setAttempt((value) => value + 1)}>
              重试
            </Button>
          </div>
        ) : result ? (
          <>
            <dl className='grid grid-cols-2 gap-y-1.5 tabular-nums'>
              <dt>已记录总量</dt>
              <dd className='text-right'>{formatTokens(totalTokens(result.total))}</dd>
              <dt>输入</dt>
              <dd className='text-right'>{formatTokens(result.total.inputTokens)}</dd>
              <dt>输出</dt>
              <dd className='text-right'>{formatTokens(result.total.outputTokens)}</dd>
              <dt>本页今日用量</dt>
              <dd className='text-right'>{formatTokens(totalTokens(result.today))}</dd>
            </dl>
            {result.total.incompleteRuns > 0 && (
              <p className='mt-2 text-xs text-muted-foreground'>
                {result.total.incompleteRuns} 次运行的用量记录不完整。
              </p>
            )}
          </>
        ) : (
          <p role='status'>正在读取页面用量…</p>
        )}
        <Button
          size='sm'
          variant='outline'
          className='mt-3 w-full'
          onClick={() => onOpenUsage({ projectId, pageId })}
        >
          查看明细
        </Button>
      </div>
    </details>
  );
};
