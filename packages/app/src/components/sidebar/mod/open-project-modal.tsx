import { Button, FieldError, Form, Input, Label, Modal, TextField } from '@heroui/react';
import { useState } from 'react';

interface OpenProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProject: (pageDirectory: string) => Promise<void>;
}

export const OpenProjectModal = ({
  isOpen,
  onClose,
  onOpenProject,
}: OpenProjectModalProps): React.JSX.Element => {
  const [pageDirectory, setPageDirectory] = useState('pages');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (): void => {
    setPageDirectory('pages');
    setError(null);
    onClose();
  };

  const open = async (): Promise<void> => {
    if (!pageDirectory.trim()) return setError('请输入页面目录路径。');
    setIsSubmitting(true);
    setError(null);
    try {
      await onOpenProject(pageDirectory.trim());
      close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '项目打开失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(visible) => !visible && close()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                void open();
              }}
            >
              <Modal.Header>
                <Modal.Heading>打开项目</Modal.Heading>
              </Modal.Header>
              <Modal.Body className='grid gap-4'>
                <TextField fullWidth isRequired>
                  <Label>页面目录路径</Label>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm text-zinc-500 dark:text-zinc-400'>src/</span>
                    <Input
                      name='pageDirectory'
                      value={pageDirectory}
                      placeholder='pages'
                      pattern='[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*'
                      onChange={(event) => setPageDirectory(event.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                  <FieldError>请输入 src 下的页面目录，例如 pages 或 modules/pages</FieldError>
                </TextField>
                <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                  选择项目目录后，将从该路径发现页面。已初始化项目仍以项目清单为准。
                </p>
                {error && <p className='text-sm text-danger'>{error}</p>}
              </Modal.Body>
              <Modal.Footer>
                <Button slot='close' variant='tertiary' type='button'>
                  取消
                </Button>
                <Button type='submit' isDisabled={isSubmitting}>
                  {isSubmitting ? '打开中…' : '选择目录并打开'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
