import { Button, Form, Input, Label, Modal, TextField } from '@heroui/react';
import { useState } from 'react';

export type LifecycleTarget =
  | { kind: 'rename-project'; id: string; name: string }
  | { kind: 'delete-project'; id: string; name: string }
  | { kind: 'rename-page'; projectId: string; id: string; name: string }
  | { kind: 'delete-page'; projectId: string; id: string; name: string };

export function LifecycleModal({
  target,
  onClose,
  onConfirm,
}: {
  target: LifecycleTarget | null;
  onClose: () => void;
  onConfirm: (target: LifecycleTarget, name?: string) => Promise<void>;
}): React.JSX.Element {
  const [name, setName] = useState(target?.name ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleting = target?.kind.startsWith('delete') === true;
  const project = target?.kind.endsWith('project') === true;

  const submit = async (): Promise<void> => {
    if (!target) return;
    if (!deleting && !name.trim()) return setError('名称不能为空');
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(target, deleting ? undefined : name.trim());
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={target !== null} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <Modal.Header>
                <Modal.Heading>
                  {deleting
                    ? `删除${project ? '项目' : '页面'}`
                    : `修改${project ? '项目' : '页面'}名称`}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className='grid gap-4'>
                {deleting ? (
                  <>
                    <p className='text-sm text-zinc-700 dark:text-zinc-300'>
                      确定删除“{target?.name}”吗？相关桌面端记录将被删除，且无法恢复。
                    </p>
                    <p className='text-xs text-zinc-400 dark:text-zinc-500'>
                      不会删除磁盘中的实际{project ? '项目' : '页面'}文件。
                    </p>
                  </>
                ) : (
                  <TextField fullWidth isRequired>
                    <Label>{project ? '项目名称' : '页面名称'}</Label>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoFocus
                      required
                    />
                    <p className='text-xs text-zinc-400 dark:text-zinc-500'>
                      不会修改磁盘中的{project ? '项目文件夹' : '页面路径'}。
                    </p>
                  </TextField>
                )}
                {error && (
                  <p role='alert' className='text-sm text-danger'>
                    {error}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button slot='close' variant='tertiary' type='button'>
                  取消
                </Button>
                <Button
                  type='submit'
                  className={deleting ? 'bg-danger text-danger-foreground' : undefined}
                  isDisabled={submitting}
                >
                  {submitting ? '处理中…' : deleting ? '删除' : '保存'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
