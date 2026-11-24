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
  toast,
} from '@origamix/ui';

import { Info } from 'lucide-react';
import { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import { projectsService } from '@/services/projects';
import { workbenchHost } from '@/utils';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateProjectModal = ({
  isOpen,
  onClose,
}: CreateProjectModalProps): React.JSX.Element => {
  const databaseProject = workbenchHost() === 'web';
  const setProjects = useWorkspaceStore((state) => state.setProjects);
  const [layoutEnabled, setLayoutEnabled] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [directory, setDirectory] = useState('');
  const [pageDirectory, setPageDirectory] = useState('pages');
  const [directoryGrantId, setDirectoryGrantId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const close = (): void => {
    setName('');
    setLayoutEnabled(false);
    setCode('');
    setDirectory('');
    setPageDirectory('pages');
    setDirectoryGrantId('');
    onClose();
  };

  const chooseDirectory = async (): Promise<void> => {
    try {
      const selected = await window.api?.dialog?.chooseProjectParent?.();
      if (selected) {
        setDirectory(selected.displayPath);
        setDirectoryGrantId(selected.directoryGrantId);
      }
    } catch (reason) {
      toast.add({
        title: reason instanceof Error ? reason.message : '无法选择目录',
        type: 'error',
      });
    }
  };

  const createProject = async (): Promise<void> => {
    if (
      !name.trim() ||
      !code.trim() ||
      !pageDirectory.trim() ||
      (!databaseProject && !directoryGrantId)
    ) {
      toast.add({ title: '请填写所有必填项。', type: 'error' });
      return;
    }
    setIsSubmitting(true);
    try {
      const project = await projectsService.create({
        name: name.trim(),
        code: code.trim(),
        pageDirectory: pageDirectory.trim(),
        ...(databaseProject ? {} : { directoryGrantId }),
        layoutEnabled,
      });
      setProjects((current) => [
        ...current,
        {
          id: project.id,
          name: project.name,
          path: project.path,
          ...(databaseProject ? { runtime: 'origamix' as const, layoutEnabled } : {}),
          pages: [],
        },
      ]);
      close();
    } catch (reason) {
      toast.add({
        title: reason instanceof Error ? reason.message : '项目创建失败',
        type: 'error',
      });
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
          <Field hidden={databaseProject}>
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
              required={!databaseProject}
            />
          </Field>
          <Field orientation='horizontal'>
            <Switch
              id='create-layout-enabled'
              checked={layoutEnabled}
              onCheckedChange={setLayoutEnabled}
              disabled={isSubmitting}
            />
            <FieldLabel htmlFor='create-layout-enabled'>启用应用布局</FieldLabel>
          </Field>
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
