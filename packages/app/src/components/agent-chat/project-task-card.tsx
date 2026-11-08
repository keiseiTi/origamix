import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@origamix/ui';
import { SYSTEM_PAGE_ROLES, type ProjectTaskState } from '@origamix/shared';

const labels: Record<string, string> = {
  awaiting_confirmation: '等待确认项目操作',
  applying_project: '项目提交结果待确认',
  project_applied: '项目已保存，等待继续页面任务',
  running_page: '项目已保存，正在处理页面',
  completed: '任务已完成',
  cancelled: '任务已取消，未执行后续页面操作',
  page_failed: '项目已保存，页面任务未完成',
  project_failed: '项目任务未完成，未执行后续页面操作',
};
export const ProjectTaskCard = ({
  task,
  busy,
  decide,
}: {
  task: ProjectTaskState;
  busy: boolean;
  decide: (decision: 'confirm' | 'cancel') => Promise<void>;
}) => {
  const [open, setOpen] = useState(task.phase === 'awaiting_confirmation');
  const [error, setError] = useState<string | null>(null);
  const actionable = ['awaiting_confirmation', 'applying_project', 'project_applied'].includes(
    task.phase,
  );
  const execute = async (decision: 'confirm' | 'cancel') => {
    setError(null);
    try {
      await decide(decision);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '结果未确认，请重新读取');
    }
  };
  const roles = SYSTEM_PAGE_ROLES;
  const pageName = (id: string | undefined) =>
    task.proposal.pages.find((page) => page.pageId === id)?.name ?? id ?? '未关联';
  const changes = SYSTEM_PAGE_ROLES.map((role) => role.id).filter(
    (id) => task.proposal.before.assignments[id] !== task.proposal.after.assignments[id],
  );
  const details = (
    <div className='space-y-2 text-sm'>
      {changes.map((id) => (
        <p key={id}>
          {roles.find((role) => role.id === id)?.name ?? id}：
          {pageName(task.proposal.before.assignments[id])} →{' '}
          {pageName(task.proposal.after.assignments[id])}
        </p>
      ))}
      <p className='text-muted-foreground'>
        后续页面任务：{task.proposal.pageIntent ?? '无，仅保存项目配置'}
      </p>
    </div>
  );
  return (
    <section
      className='mt-4 space-y-3 rounded-xl border border-border bg-muted/30 p-4'
      aria-label='项目操作提案'
    >
      <p role='status' className='text-sm font-medium'>
        {labels[task.phase]}
      </p>
      {details}
      {task.failure && <p className='text-sm text-destructive'>{task.failure}</p>}
      {actionable && (
        <Button size='sm' variant='outline' disabled={busy} onClick={() => setOpen(true)}>
          {task.phase === 'awaiting_confirmation' ? '查看并确认项目操作' : '恢复项目任务'}
        </Button>
      )}
      <Dialog open={open} onOpenChange={(value) => !busy && setOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认项目操作</DialogTitle>
            <DialogDescription>
              先保存项目配置，成功后继续当前页面任务。取消将停止整个任务。角色配置不会改变布局或自动保存页面版本。
            </DialogDescription>
          </DialogHeader>
          {details}
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant='outline' disabled={busy} onClick={() => setOpen(false)}>
              稍后处理
            </Button>
            {task.phase === 'awaiting_confirmation' && (
              <Button variant='outline' disabled={busy} onClick={() => void execute('cancel')}>
                取消整个任务
              </Button>
            )}
            <Button disabled={busy} onClick={() => void execute('confirm')}>
              {busy
                ? '处理中…'
                : task.phase === 'awaiting_confirmation'
                  ? '确认并继续'
                  : '恢复并继续'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
