import { Button, Form, Input, Label, Modal, TextField } from '@heroui/react';
import { useState } from 'react';
import type { ProjectItem } from '..';
import { backendApi } from '../../../services/backend-api';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: ProjectItem) => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onCreated
}: CreateProjectModalProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [directory, setDirectory] = useState('');
  const [directoryGrantId, setDirectoryGrantId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (): void => {
    setName('');
    setDirectory('');
    setDirectoryGrantId('');
    setError(null);
    onClose();
  };

  const chooseDirectory = async (): Promise<void> => {
    const selected = await window.api.dialog.chooseProjectParent();
    if (selected) {
      setDirectory(selected.displayPath);
      setDirectoryGrantId(selected.directoryGrantId);
    }
  };

  const createProject = async (): Promise<void> => {
    if (!name.trim() || !code.trim() || !directoryGrantId) {
      return setError('请填写所有必填项。');
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const project = await backendApi.projects.create({ name: name.trim(), directoryGrantId });
      onCreated({ id: project.id, name: project.name, path: project.path, pages: [] });
      close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '项目创建失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && close()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                void createProject();
              }}
            >
              <Modal.Header>
                <Modal.Heading>新建项目</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="grid gap-4">
                <TextField fullWidth isRequired>
                  <Label>项目名称</Label>
                  <Input
                    name="projectName"
                    value={name}
                    placeholder="请输入"
                    onChange={(event) => setName(event.target.value)}
                    autoFocus
                    required
                  />
                </TextField>
                <TextField fullWidth isRequired>
                  <Label>项目编码</Label>
                  <Input
                    name="projectCode"
                    value={code}
                    placeholder="请输入"
                    onChange={(event) => setCode(event.target.value)}
                    required
                  />
                </TextField>
                <TextField fullWidth isRequired>
                  <Label>生成地址</Label>
                  <Input
                    name="directory"
                    className="flex-1"
                    onClick={chooseDirectory}
                    value={directory}
                    readOnly
                    placeholder="选择目录"
                    required
                  />
                </TextField>
                {error && <p className="text-sm text-danger">{error}</p>}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="tertiary" type="button">
                  取消
                </Button>
                <Button type="submit" isDisabled={isSubmitting}>
                  {isSubmitting ? '创建中…' : '创建项目'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
