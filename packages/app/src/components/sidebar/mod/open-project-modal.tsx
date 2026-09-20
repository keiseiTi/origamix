import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Field, FieldLabel } from '../../ui/field';
import { Input } from '../../ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import { Info } from 'lucide-react';
import { useState } from 'react';
import type { PendingProjectInitialization } from '../../../hooks/use-project-actions';

interface OpenProjectModalProps {
  pendingInitialization: PendingProjectInitialization;
  initializing: boolean;
  onCancel: () => void;
  onInitialize: (input: { name: string; code: string; pageDirectory: string }) => Promise<void>;
}

const suggestedProjectIdentity = (displayPath: string): { name: string; code: string } => {
  const directoryName = displayPath.split(/[\\/]/).filter(Boolean).at(-1) ?? '';
  const code =
    directoryName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'imported-project';
  return { name: directoryName, code };
};

export const OpenProjectModal = ({
  pendingInitialization,
  initializing,
  onCancel,
  onInitialize,
}: OpenProjectModalProps): React.JSX.Element => {
  const suggested = suggestedProjectIdentity(pendingInitialization.displayPath);
  const [name, setName] = useState(suggested.name);
  const [code, setCode] = useState(suggested.code);
  const [pageDirectory, setPageDirectory] = useState('pages');
  const [error, setError] = useState<string | null>(null);

  const initialize = async (): Promise<void> => {
    if (!name.trim() || !code.trim() || !pageDirectory.trim())
      return setError('请填写所有必填项。');
    setError(null);
    try {
      await onInitialize({
        name: name.trim(),
        code: code.trim(),
        pageDirectory: pageDirectory.trim(),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '初始化失败');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void initialize();
          }}
          className='grid gap-4'
        >
          <DialogHeader>
            <DialogTitle>初始化项目</DialogTitle>
          </DialogHeader>
          <p className='text-sm text-zinc-700 dark:text-zinc-300'>
            选择的目录尚未初始化为 Origamix 项目。确认以下信息后将创建项目清单。
          </p>
          <p className='break-all text-xs text-zinc-400 dark:text-zinc-500'>
            {pendingInitialization?.displayPath}
          </p>
          <Field>
            <FieldLabel htmlFor='openProjectName'>项目名称</FieldLabel>
            <Input
              id='openProjectName'
              name='projectName'
              value={name}
              placeholder='请输入'
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor='openProjectCode'>项目标识</FieldLabel>
            <Input
              id='openProjectCode'
              name='projectCode'
              value={code}
              placeholder='请输入'
              pattern='[a-z0-9]+(?:-[a-z0-9]+)*'
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </Field>
          <Field>
            <div className='flex items-center gap-1.5'>
              <FieldLabel htmlFor='openPageDirectory'>页面目录路径</FieldLabel>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type='button'
                      size='icon-xs'
                      variant='ghost'
                      className='size-5 text-zinc-500 dark:text-zinc-400'
                      aria-label='页面目录路径说明'
                    />
                  }
                >
                  <Info size={14} />
                </TooltipTrigger>
                <TooltipContent>页面默认创建在 src 路径下</TooltipContent>
              </Tooltip>
            </div>
            <div className='flex items-center gap-2'>
              <Input
                id='openPageDirectory'
                name='pageDirectory'
                value={pageDirectory}
                placeholder='pages'
                pattern='[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*'
                onChange={(event) => setPageDirectory(event.target.value)}
                required
              />
            </div>
          </Field>
          {error && <p className='text-sm text-danger'>{error}</p>}
          <DialogFooter>
            <Button variant='outline' type='button' onClick={onCancel}>
              取消
            </Button>
            <Button type='submit' disabled={initializing}>
              {initializing ? '初始化中…' : '初始化并打开'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
