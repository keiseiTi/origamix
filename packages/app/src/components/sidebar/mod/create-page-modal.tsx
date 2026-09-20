import { Button } from '../../ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Field, FieldLabel } from '../../ui/field';
import { Input } from '../../ui/input';
import { useState } from 'react';
import { useWorkspaceStore, type PageItem } from '../../../store/workspace';
import { projectsService } from '../../../services/projects';

interface CreatePageModalProps {
  projectId: string | null;
  onClose: () => void;
  onCreated: (projectId: string, page: PageItem) => void;
}

export const CreatePageModal = ({
  projectId,
  onClose,
  onCreated,
}: CreatePageModalProps): React.JSX.Element => {
  const project = useWorkspaceStore((state) =>
    state.projects.find((item) => item.id === projectId),
  );
  const [name, setName] = useState('');
  const [fileName, setFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (): void => {
    setName('');
    setFileName('');
    setError(null);
    onClose();
  };

  const createPage = async (): Promise<void> => {
    if (!project || !name.trim() || !fileName.trim()) {
      return setError('请填写页面名称和文件名称。');
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const page = await projectsService.createPage(project.id, {
        name: name.trim(),
        slug: fileName.trim(),
      });
      onCreated(project.id, { id: page.id, name: page.name, fileName: page.slug });
      close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '页面创建失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={projectId !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void createPage();
          }}
          className='grid gap-4'
        >
          <DialogHeader>
            <DialogTitle>新建页面</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor='pageName'>页面名称</FieldLabel>
            <Input
              id='pageName'
              name='pageName'
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder='请输入'
              autoFocus
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor='fileName'>页面标识</FieldLabel>
            <Input
              id='fileName'
              name='fileName'
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              placeholder='例如：customer-list'
              required
            />
          </Field>
          {error && <p className='text-sm text-danger'>{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button variant='outline' type='button' />}>取消</DialogClose>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? '创建中…' : '创建页面'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
