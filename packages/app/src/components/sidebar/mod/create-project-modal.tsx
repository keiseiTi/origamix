import {
  Button,
  toast,
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
import {
  pickProjectParent,
  supportsProjectDirectory,
  type ProjectDirectory,
} from '@/services/project-directory';
import { bindProjectParent, syncProjectToDirectory } from '@/services/project-sync';
import { projectsService, usesDatabaseProjects } from '@/services/projects';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateProjectModal = ({
  isOpen,
  onClose,
}: CreateProjectModalProps): React.JSX.Element => {
  const databaseProject = usesDatabaseProjects();
  const setProjects = useWorkspaceStore((state) => state.setProjects);
  const [layoutEnabled, setLayoutEnabled] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [webParent, setWebParent] = useState<ProjectDirectory>();
  const [directory, setDirectory] = useState('');
  const [pageDirectory, setPageDirectory] = useState('pages');
  const [directoryGrantId, setDirectoryGrantId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (): void => {
    setName('');
    setLayoutEnabled(false);
    setCode('');
    setDirectory('');
    setWebParent(undefined);
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
    if (
      !name.trim() ||
      !code.trim() ||
      !pageDirectory.trim() ||
      (!databaseProject && !directoryGrantId)
    ) {
      return setError('请填写所有必填项。');
    }
    setIsSubmitting(true);
    setError(null);
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
      if (webParent) {
        try {
          await bindProjectParent(project.id, webParent);
          await syncProjectToDirectory(project.id);
          toast.add({ title: '项目已生成到本地', type: 'success' });
        } catch (reason) {
          toast.add({
            title: '网页项目已创建，本地初始化失败',
            description: `${reason instanceof Error ? reason.message : '无法写入目录'} 可从项目菜单重试同步。`,
            type: 'error',
          });
        }
      }
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
          {databaseProject && supportsProjectDirectory() && (
            <Field>
              <FieldLabel htmlFor='web-project-directory'>本机父目录（可选）</FieldLabel>
              <Button
                id='web-project-directory'
                type='button'
                variant='outline'
                onClick={() => {
                  void pickProjectParent()
                    .then(setWebParent)
                    .catch((reason: unknown) => {
                      if (!(reason instanceof DOMException && reason.name === 'AbortError'))
                        setError(reason instanceof Error ? reason.message : '无法选择本机目录');
                    });
                }}
              >
                {webParent?.name ?? '选择父目录'}
              </Button>
            </Field>
          )}
          <Field orientation='horizontal'>
            <Switch
              id='create-layout-enabled'
              checked={layoutEnabled}
              onCheckedChange={setLayoutEnabled}
              disabled={isSubmitting}
            />
            <FieldLabel htmlFor='create-layout-enabled'>启用应用布局</FieldLabel>
          </Field>

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
