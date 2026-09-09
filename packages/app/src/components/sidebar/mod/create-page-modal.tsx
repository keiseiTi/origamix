import { Button, Form, Input, Label, Modal, TextField } from '@heroui/react';
import { useState } from 'react';
import type { PageItem, ProjectItem } from '..';
import { projectsService } from '../../../services/projects';

interface CreatePageModalProps {
  project: ProjectItem | null;
  onClose: () => void;
  onCreated: (projectId: string, page: PageItem) => void;
}

export function CreatePageModal({
  project,
  onClose,
  onCreated,
}: CreatePageModalProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [fileName, setFileName] = useState('');
  const [route, setRoute] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (): void => {
    setName('');
    setFileName('');
    setRoute('');
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
        route: route.trim() || `/${fileName.trim()}`,
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
    <Modal isOpen={project !== null} onOpenChange={(open) => !open && close()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                void createPage();
              }}
            >
              <Modal.Header>
                <Modal.Heading>新建页面</Modal.Heading>
              </Modal.Header>
              <Modal.Body className='grid gap-4'>
                <TextField fullWidth isRequired>
                  <Label>页面名称</Label>
                  <Input
                    name='pageName'
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder='请输入'
                    autoFocus
                    required
                  />
                </TextField>
                <TextField fullWidth>
                  <Label>页面路由</Label>
                  <Input
                    name='route'
                    value={route}
                    onChange={(event) => setRoute(event.target.value)}
                    placeholder={fileName.trim() ? `/${fileName.trim()}` : '/customer-list'}
                  />
                </TextField>
                <TextField fullWidth isRequired>
                  <Label>页面标识</Label>
                  <Input
                    name='fileName'
                    value={fileName}
                    onChange={(event) => setFileName(event.target.value)}
                    placeholder='例如：customer-list'
                    required
                  />
                </TextField>
                {error && <p className='text-sm text-danger'>{error}</p>}
              </Modal.Body>
              <Modal.Footer>
                <Button slot='close' variant='tertiary' type='button'>
                  取消
                </Button>
                <Button type='submit' isDisabled={isSubmitting}>
                  {isSubmitting ? '创建中…' : '创建页面'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
