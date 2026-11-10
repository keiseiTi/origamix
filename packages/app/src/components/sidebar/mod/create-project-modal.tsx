import {
  DEFAULT_PROJECT_ROUTING,
  isProjectRouting,
  type InitialLayoutVariant,
  type ProjectRouting,
} from '@origamix/shared';
import { RoutingFields } from '@/components/project-settings/routing-fields';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@origamix/ui';

import { Info } from 'lucide-react';
import { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import { projectsService } from '@/services/projects';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateProjectModal = ({
  isOpen,
  onClose,
}: CreateProjectModalProps): React.JSX.Element => {
  const setProjects = useWorkspaceStore((state) => state.setProjects);
  const [layoutVariant, setLayoutVariant] = useState<InitialLayoutVariant>('side');
  const [routing, setRouting] = useState<ProjectRouting>({ ...DEFAULT_PROJECT_ROUTING });
  const [layoutEnabled, setLayoutEnabled] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [directory, setDirectory] = useState('');
  const [pageDirectory, setPageDirectory] = useState('pages');
  const [directoryGrantId, setDirectoryGrantId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (): void => {
    setName('');
    setLayoutEnabled(false);
    setLayoutVariant('side');
    setRouting({ ...DEFAULT_PROJECT_ROUTING });
    setDirectory('');
    setPageDirectory('pages');
    setDirectoryGrantId('');
    setError(null);
    onClose();
  };

  const chooseDirectory = async (): Promise<void> => {
    const selected = await window.api?.dialog?.chooseProjectParent?.();
    if (selected) {
      setDirectory(selected.displayPath);
      setDirectoryGrantId(selected.directoryGrantId);
    }
  };

  const createProject = async (): Promise<void> => {
    if (!name.trim() || !code.trim() || !pageDirectory.trim() || !directoryGrantId) {
      return setError('请填写所有必填项。');
    }
    if (!isProjectRouting(routing))
      return setError(
        '应用访问前缀应为 / 或 /admin/ 等目录路径，只支持字母、数字、连字符和下划线。',
      );
    setIsSubmitting(true);
    setError(null);
    try {
      const project = await projectsService.create({
        name: name.trim(),
        code: code.trim(),
        pageDirectory: pageDirectory.trim(),
        directoryGrantId,
        layoutEnabled,
        layoutVariant,
        routing,
      });
      setProjects((current) => [
        ...current,
        { id: project.id, name: project.name, path: project.path, pages: [] },
      ]);
      close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '项目创建失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className='max-h-[90vh] overflow-y-auto'>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void createProject();
          }}
          className='grid gap-4'
        >
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor='projectName'>项目名称</FieldLabel>
            <Input
              id='projectName'
              name='projectName'
              value={name}
              placeholder='请输入'
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor='projectCode'>项目标识</FieldLabel>
            <Input
              id='projectCode'
              name='projectCode'
              value={code}
              placeholder='请输入'
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </Field>
          <Field>
            <div className='flex items-center gap-1.5'>
              <FieldLabel htmlFor='pageDirectory'>页面目录路径</FieldLabel>
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
                <TooltipContent>页面创建在 src 路径下</TooltipContent>
              </Tooltip>
            </div>
            <div className='flex items-center gap-2'>
              <Input
                id='pageDirectory'
                name='pageDirectory'
                value={pageDirectory}
                placeholder='pages'
                pattern='[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*'
                onChange={(event) => setPageDirectory(event.target.value)}
                required
              />
            </div>
          </Field>
          <Field>
            <div className='flex items-center gap-1.5'>
              <FieldLabel htmlFor='directory'>生成地址</FieldLabel>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type='button'
                      size='icon-xs'
                      variant='ghost'
                      className='size-5 text-zinc-500 dark:text-zinc-400'
                      aria-label='生成地址说明'
                    />
                  }
                >
                  <Info size={14} />
                </TooltipTrigger>
                <TooltipContent>项目生成的路径地址</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id='directory'
              name='directory'
              className='flex-1'
              onClick={chooseDirectory}
              value={directory}
              readOnly
              placeholder='选择目录'
              required
            />
          </Field>
          <RoutingFields value={routing} onChange={setRouting} disabled={isSubmitting} />
          <Field orientation='horizontal'>
            <Switch
              id='create-layout-enabled'
              checked={layoutEnabled}
              onCheckedChange={setLayoutEnabled}
              disabled={isSubmitting}
            />
            <FieldLabel htmlFor='create-layout-enabled'>启用应用布局</FieldLabel>
          </Field>
          {layoutEnabled && (
            <Field>
              <FieldLabel>初始布局</FieldLabel>
              <div role='group' aria-label='初始布局' className='grid grid-cols-3 gap-2'>
                {(
                  [
                    { value: 'side', label: '左侧菜单' },
                    { value: 'top', label: '顶部菜单' },
                    { value: 'mix', label: '混合菜单' },
                  ] as const
                ).map((item) => (
                  <Button
                    type='button'
                    key={item.value}
                    disabled={isSubmitting}
                    variant={layoutVariant === item.value ? 'secondary' : 'outline'}
                    aria-pressed={layoutVariant === item.value}
                    onClick={() => setLayoutVariant(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <p className='text-xs text-muted-foreground'>
                创建后通过 AI 对话调整布局，保存版本并应用后在目标项目生效。
              </p>
            </Field>
          )}

          {error && <p className='text-sm text-danger'>{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button variant='outline' type='button' />}>取消</DialogClose>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? '创建中…' : '创建项目'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
